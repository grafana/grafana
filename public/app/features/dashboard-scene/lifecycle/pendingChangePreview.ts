import { locationService } from '@grafana/runtime';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { getPluginExtensionRegistries } from 'app/features/plugins/extensions/registry/setup';
import { getAppPluginConfigs, getExtensionPointPluginDependencies } from 'app/features/plugins/extensions/utils';
import { preloadPlugins } from 'app/features/plugins/pluginPreloader';

/**
 * Pending changes preview. Grafana doesn't store pending changes: the plugin that proposed
 * them (Grafana Assistant) keeps them and registers a loader at
 * PENDING_CHANGES_EXTENSION_POINT. A dashboard opens with one set of them, read-only, under a
 * banner, when the page URL has `?pendingChanges=<id>` or the embedded dashboard view is given
 * an id. **Show original** switches to the saved dashboard; the choice is kept per dashboard
 * and id for the browser tab, so a reload keeps it. The page and the embedded view each keep
 * their own preview, so the same dashboard can be open in both.
 */

/** Plugins register a DashboardPendingChangesLoader here (addFunction). */
const PENDING_CHANGES_EXTENSION_POINT = 'grafana/dashboard/pending-changes/v1';

/** The dashboard page query parameter naming the pending changes to preview. */
export const PENDING_CHANGES_QUERY_PARAM = 'pendingChanges';

type ApplyPendingChangesResult = { applied: true } | { applied: false; currentGeneration: number };

/** One set of pending changes to a dashboard, as its plugin supplies them. */
export interface DashboardPendingChanges {
  /** The dashboard version the changes start from. */
  baseGeneration: number;
  /** The full proposed v2 dashboard spec. */
  proposed: DashboardV2Spec;
  /** Who made the changes, shown in the banner, for example "made by Assistant". */
  source?: string;
  /**
   * Saves the changes to the dashboard as the requester, then forgets them. Without force,
   * reports the dashboard's current version instead when it moved on from baseGeneration.
   */
  apply(options: { force: boolean }): Promise<ApplyPendingChangesResult>;
  /** Forgets the changes; the dashboard isn't affected. */
  discard(): Promise<void>;
  /** Opens where the changes were made, to bring them up to date with the dashboard. */
  update?(): void;
}

type DashboardPendingChangesLoader = (request: { uid: string; id: string }) => Promise<DashboardPendingChanges | null>;

const ORIGINAL_VIEW_KEY = 'grafana.dashboard.pendingChanges.showOriginal';

/** Where a dashboard is shown: the dashboard page, or the embedded dashboard view. */
export type PendingChangesView = 'page' | 'embedded';

export interface PendingChangePreview {
  id: string;
  pending: DashboardPendingChanges;
  /** True while the scene shows the proposed spec; false while it shows the saved dashboard. */
  previewing: boolean;
}

const previews = new Map<string, PendingChangePreview>();

const previewKey = (view: PendingChangesView, uid: string) => `${view}/${uid}`;

const viewKey = (uid: string, id: string) => `${uid}/${id}`;

function originalViews(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(ORIGINAL_VIEW_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Whether the requester chose to see the saved dashboard instead of these pending changes. */
function isShowingOriginal(uid: string, id: string): boolean {
  return originalViews().has(viewKey(uid, id));
}

export function setShowOriginal(uid: string, id: string, showOriginal: boolean) {
  const views = originalViews();
  if (showOriginal) {
    views.add(viewKey(uid, id));
  } else {
    views.delete(viewKey(uid, id));
  }
  try {
    window.sessionStorage.setItem(ORIGINAL_VIEW_KEY, JSON.stringify([...views]));
  } catch {
    // Without session storage the choice lasts until the next reload.
  }
}

/** The pending changes state of a dashboard as last loaded in this view, if it has any. */
export function getPendingChangePreview(
  view: PendingChangesView,
  uid: string | undefined
): PendingChangePreview | undefined {
  return uid ? previews.get(previewKey(view, uid)) : undefined;
}

/** Whether the dashboard page shows pending changes to this dashboard. */
export function isPreviewingPendingChanges(uid: string | undefined): boolean {
  return Boolean(getPendingChangePreview('page', uid)?.previewing);
}

/** The id of the pending changes the dashboard page URL asks for. */
export function pendingChangesIdFromLocation(): string | undefined {
  const value = locationService.getSearchObject()[PENDING_CHANGES_QUERY_PARAM];
  return typeof value === 'string' && value ? value : undefined;
}

function isLoader(fn: unknown): fn is DashboardPendingChangesLoader {
  return typeof fn === 'function';
}

/** How long the dashboard waits for a plugin's pending changes before it shows the saved one. */
const LOADER_TIMEOUT_MS = 10_000;

/** A loader's pending changes, or null when it throws, fails, or doesn't answer in time. */
async function askLoader(
  load: DashboardPendingChangesLoader,
  request: { uid: string; id: string }
): Promise<DashboardPendingChanges | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), LOADER_TIMEOUT_MS);
  });
  try {
    // Called inside the promise chain so a synchronous throw is handled like a rejection.
    return await Promise.race([Promise.resolve().then(() => load(request)), timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The registered loaders. Loads the plugins that declare one (plugin.json addedFunctions) first,
 * as usePluginFunctions does: a dashboard opened straight from a link can load before them.
 */
async function getLoaders(): Promise<DashboardPendingChangesLoader[]> {
  const pluginIds = await getExtensionPointPluginDependencies(PENDING_CHANGES_EXTENSION_POINT);
  if (pluginIds.length === 0) {
    return [];
  }
  await preloadPlugins(await getAppPluginConfigs(pluginIds));
  const { addedFunctionsRegistry } = await getPluginExtensionRegistries();
  const state = await addedFunctionsRegistry.getState();
  return (state[PENDING_CHANGES_EXTENSION_POINT] ?? []).flatMap((item) => (isLoader(item.fn) ? [item.fn] : []));
}

/**
 * Loads the pending changes `id` names before the dashboard is shown, and records whether
 * the scene should show them. Failures leave the saved dashboard on screen: a missing or
 * disabled plugin, one that fails to load, and a loader that throws, rejects, or hangs.
 */
export async function loadPendingChangePreview(
  view: PendingChangesView,
  uid: string | undefined,
  id: string | undefined
): Promise<PendingChangePreview | undefined> {
  if (!uid) {
    return undefined;
  }
  previews.delete(previewKey(view, uid));
  // No flag here: nothing happens without an id in the URL and a plugin that returns
  // changes for it, and the plugin decides whether it does.
  if (!id) {
    return undefined;
  }
  let loaders: DashboardPendingChangesLoader[];
  try {
    loaders = await getLoaders();
  } catch {
    return undefined;
  }
  for (const load of loaders) {
    const pending = await askLoader(load, { uid, id });
    if (pending) {
      const preview = { id, pending, previewing: !isShowingOriginal(uid, id) };
      previews.set(previewKey(view, uid), preview);
      return preview;
    }
  }
  return undefined;
}

/** Forgets a dashboard's pending changes, in every view, after they were applied or discarded. */
export function clearPendingChangePreview(uid: string, id: string) {
  for (const view of ['page', 'embedded'] as const) {
    if (previews.get(previewKey(view, uid))?.id === id) {
      previews.delete(previewKey(view, uid));
    }
  }
  setShowOriginal(uid, id, false);
}
