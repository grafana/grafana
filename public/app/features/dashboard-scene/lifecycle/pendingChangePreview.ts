import { locationService } from '@grafana/runtime';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { getPluginExtensionRegistries } from 'app/features/plugins/extensions/registry/setup';
import { getAppPluginConfigs, getExtensionPointPluginDependencies } from 'app/features/plugins/extensions/utils';
import { preloadPlugins } from 'app/features/plugins/pluginPreloader';
import { type DashboardMeta } from 'app/types/dashboard';

import { isPendingChangesEnabled } from './pendingChangesFlag';

/**
 * Pending changes preview. Grafana doesn't store pending changes: the plugin that proposed
 * them (Grafana Assistant) keeps them and registers a loader at
 * PENDING_CHANGES_EXTENSION_POINT. A dashboard opens with one set of them under a banner, when
 * the page URL has `?pendingChanges=<id>` or the embedded dashboard view is given an id. The
 * preview is read-only, except on the page when the plugin keeps their history (`history`):
 * there each edit is recorded as the pending changes, and Undo and Redo step through the
 * plugin's history instead of the dashboard's own (see pendingChangesHistory.ts). Apply still
 * saves the dashboard. **Show original** switches to the saved dashboard; the choice is kept per dashboard
 * and id for the browser tab, so a reload keeps it. The page and the embedded view each keep
 * their own preview, so the same dashboard can be open in both.
 *
 * Pending changes based on version 0 propose a new dashboard under a uid nothing has yet. It
 * opens as an unsaved dashboard, and saving it creates it under that uid (`newDashboardUid` in
 * the scene's meta), after which the plugin is told to discard the proposal.
 */

/** Plugins register a DashboardPendingChangesLoader here (addFunction). */
const PENDING_CHANGES_EXTENSION_POINT = 'grafana/dashboard/pending-changes/v1';

/** The dashboard page query parameter naming the pending changes to preview. */
export const PENDING_CHANGES_QUERY_PARAM = 'pendingChanges';

/**
 * With `original`, the dashboard page shows the saved dashboard instead of the pending changes,
 * with a way back to them. In the URL so a plugin linking to the page can tell which it shows.
 */
export const PENDING_CHANGES_VIEW_QUERY_PARAM = 'pendingChangesView';

type ApplyPendingChangesResult = { applied: true } | { applied: false; currentGeneration: number };

/** Labels of the steps Undo and Redo would take; a missing one turns its button off. */
export interface PendingChangesHistoryState {
  undo?: string;
  redo?: string;
  /** The pending changes as last recorded, which the banner diffs instead of `proposed`. */
  proposed?: DashboardV2Spec;
}

/**
 * The plugin's history of the pending changes: each edit the requester makes on the page is a
 * step in it, like the plugin's own changes, so they share one Undo and Redo.
 */
export interface PendingChangesHistory {
  /**
   * Records an edit, made on the page, as the pending changes: `description` names it, as the
   * dashboard's Undo does. recorded: false when the pending changes changed since the page last
   * loaded them, so the edit wasn't kept.
   */
  record(change: { proposed: DashboardV2Spec; description?: string }): Promise<{ recorded: boolean }>;
  /** Steps back or forward, then reloads the page (RELOAD_FROM_SERVER) to show the result. */
  undo(): Promise<void>;
  redo(): Promise<void>;
  getState(): PendingChangesHistoryState;
  subscribe(listener: () => void): () => void;
}

/** One set of pending changes to a dashboard, as its plugin supplies them. */
export interface DashboardPendingChanges {
  /** The dashboard version the changes start from: 0 proposes a new dashboard. */
  baseGeneration: number;
  /** The full proposed v2 dashboard spec. */
  proposed: DashboardV2Spec;
  /** Who made the changes, shown in the banner, for example "made by Assistant". */
  source?: string;
  /**
   * Saves the changes to the dashboard as the requester, then forgets them. Without force,
   * reports the dashboard's current version instead when it moved on from baseGeneration.
   * Not called for a new dashboard, which the requester saves instead.
   */
  apply(options: { force: boolean }): Promise<ApplyPendingChangesResult>;
  /** Without it, the preview is read-only. */
  history?: PendingChangesHistory;
  /** Forgets the changes; the dashboard isn't affected. Also called once a new dashboard was saved. */
  discard(): Promise<void>;
  /** Opens where the changes were made, to bring them up to date with the dashboard. */
  update?(): void;
}

type DashboardPendingChangesLoader = (request: { uid: string; id: string }) => Promise<DashboardPendingChanges | null>;

/** The embedded view's Show original choices, which have no URL to live in. */
const ORIGINAL_VIEW_KEY = 'grafana.dashboard.pendingChanges.showOriginal';

/** The pending changes whose highlights the requester turned off, for the browser tab. */
const UNHIGHLIGHTED_KEY = 'grafana.dashboard.pendingChanges.unhighlighted';

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

/** A per-tab set of `uid/id` keys in session storage. */
function storedViews(storageKey: string): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Whether the requester chose to see the saved dashboard instead of these pending changes. */
function isShowingOriginal(view: PendingChangesView, uid: string, id: string): boolean {
  return view === 'page'
    ? locationService.getSearchObject()[PENDING_CHANGES_VIEW_QUERY_PARAM] === 'original'
    : storedViews(ORIGINAL_VIEW_KEY).has(viewKey(uid, id));
}

/**
 * Shows the saved dashboard instead of the pending changes, or the pending changes again. The
 * page changes its URL, which reloads it; the embedded view remembers the choice for the tab and
 * reloads itself (`reload`).
 */
export async function showOriginal(
  view: PendingChangesView,
  uid: string,
  id: string,
  original: boolean,
  reload: () => Promise<void>
) {
  if (view === 'page') {
    locationService.partial({ [PENDING_CHANGES_VIEW_QUERY_PARAM]: original ? 'original' : null }, true);
    return;
  }
  setShowOriginal(uid, id, original);
  await reload();
}

function setStoredView(storageKey: string, uid: string, id: string, on: boolean) {
  const views = storedViews(storageKey);
  if (on) {
    views.add(viewKey(uid, id));
  } else {
    views.delete(viewKey(uid, id));
  }
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify([...views]));
  } catch {
    // Without session storage the choice lasts until the next reload.
  }
}

function setShowOriginal(uid: string, id: string, showOriginal: boolean) {
  setStoredView(ORIGINAL_VIEW_KEY, uid, id, showOriginal);
}

/**
 * Whether these pending changes are highlighted: unless the requester turned it off. Kept for the
 * tab, because a new change from the plugin reloads the dashboard and its banner.
 */
export function isHighlightingChanges(uid: string, id: string): boolean {
  return !storedViews(UNHIGHLIGHTED_KEY).has(viewKey(uid, id));
}

export function setHighlightingChanges(uid: string, id: string, on: boolean) {
  setStoredView(UNHIGHLIGHTED_KEY, uid, id, !on);
}

/** Whether the pending changes propose a new dashboard rather than change a saved one. */
export function proposesNewDashboard(pending: Pick<DashboardPendingChanges, 'baseGeneration'>): boolean {
  return pending.baseGeneration === 0;
}

/** The dashboard a scene previews pending changes to: its uid, or the uid a new one is proposed under. */
export function previewedDashboardUid({ uid, meta }: { uid?: string; meta: DashboardMeta }): string | undefined {
  return uid || meta.newDashboardUid || undefined;
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

/**
 * The history of the pending changes the dashboard page shows, when the plugin keeps it: edits
 * on the page are recorded in it, and Undo and Redo step through it.
 */
export function getPendingChangesHistory(scene: {
  uid?: string;
  meta: DashboardMeta;
}): PendingChangesHistory | undefined {
  const preview = getPendingChangePreview('page', previewedDashboardUid(scene));
  return preview?.previewing ? preview.pending.history : undefined;
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
  // With the flag off, a ?pendingChanges link opens the saved dashboard, and no plugin is loaded.
  if (!id || !isPendingChangesEnabled()) {
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
      // A new dashboard has no saved original to show instead.
      const preview = { id, pending, previewing: proposesNewDashboard(pending) || !isShowingOriginal(view, uid, id) };
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
  setHighlightingChanges(uid, id, true);
}

/** A dashboard page search string without the pending changes preview. */
export function withoutPendingChangesPreview(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(PENDING_CHANGES_QUERY_PARAM);
  params.delete(PENDING_CHANGES_VIEW_QUERY_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

/**
 * After the requester saved a new dashboard proposed as pending changes: the proposal is the
 * dashboard now, so the plugin discards it. A failed discard is harmless, since pending changes
 * to version 0 no longer apply once the dashboard exists.
 */
export async function finishSavingNewDashboard(uid: string): Promise<void> {
  const preview = getPendingChangePreview('page', uid) ?? getPendingChangePreview('embedded', uid);
  if (!preview) {
    return;
  }
  clearPendingChangePreview(uid, preview.id);
  try {
    await preview.pending.discard();
  } catch {
    // See above.
  }
}
