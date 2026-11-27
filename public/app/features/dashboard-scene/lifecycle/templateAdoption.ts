import { useSyncExternalStore } from 'react';

import { locationService } from '@grafana/runtime';
import { DASHBOARD_LIBRARY_ROUTES } from 'app/features/dashboard/dashgrid/types';
import { getPluginExtensionRegistries } from 'app/features/plugins/extensions/registry/setup';
import { getAppPluginConfigs, getExtensionPointPluginDependencies } from 'app/features/plugins/extensions/utils';
import { preloadPlugins } from 'app/features/plugins/pluginPreloader';
import { type DashboardMeta } from 'app/types/dashboard';

import { PENDING_CHANGES_QUERY_PARAM } from './pendingChangePreview';
import { isPendingChangesEnabled } from './pendingChangesFlag';

/**
 * A template opened for the Assistant to build from (from the new-dashboard prompt, or Customize with
 * Assistant), which the Assistant makes the conversation's draft once the template page shows it, and
 * then moves the page to the draft. Grafana covers both pages with the building screen meanwhile, so
 * the template doesn't flash on screen before the draft replaces it. Under the screen the template
 * still loads, renders and reports as it does uncovered.
 *
 * Kept in memory, never in the URL: a reload never reopens a screen that nothing would end, and the
 * pages keep their URLs, so their page views stay as they are.
 */
export interface TemplateAdoption {
  /** When the screen came up: each page that shows it continues the same animation. */
  startedAt: number;
}

/**
 * Plugins register a TemplateAdopter here (addFunction). It answers whether the next send from the
 * template page about to open makes that template the conversation's draft, and calls `onSettled`
 * once that adoption is over, whatever came of it: the screen then gives way to what the page shows.
 */
export const TEMPLATE_ADOPTION_EXTENSION_POINT = 'grafana/dashboard/template-adoption/v1';

export type TemplateAdopter = (request: { onSettled: () => void }) => boolean | Promise<boolean>;

/**
 * The longest the screen stays up. An adoption still running then shows the template until it
 * moves the page to the draft, as without the screen.
 */
export const TEMPLATE_ADOPTION_TIMEOUT_MS = 15_000;

/** How long a plugin has to say whether it adopts the template; the template loads meanwhile. */
const ADOPTER_TIMEOUT_MS = 1_000;

let current: TemplateAdoption | undefined;
let stopWatching: (() => void) | undefined;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTemplateAdoption(): TemplateAdoption | undefined {
  return current;
}

export function useTemplateAdoption(): TemplateAdoption | undefined {
  return useSyncExternalStore(subscribe, getTemplateAdoption);
}

/**
 * Whether the screen covers this dashboard: any shown on the page while a template is adopted,
 * except the draft it becomes (a new dashboard proposed as pending changes) and dashboards embedded
 * in other views.
 */
export function coversDashboard({ meta }: { meta: DashboardMeta }): boolean {
  return Boolean(current) && !meta.newDashboardUid && !meta.isEmbedded;
}

/** The pages an adoption moves through: the template's, and the draft's it moves to. */
function isAdoptionPage(pathname: string, search: string): boolean {
  return (
    pathname === DASHBOARD_LIBRARY_ROUTES.Template ||
    (pathname.startsWith('/d/') && new URLSearchParams(search).has(PENDING_CHANGES_QUERY_PARAM))
  );
}

/**
 * Covers the template page about to open, and the draft page the Assistant moves it to, with the
 * building screen. Call right before navigating to the template. Only while Grafana previews
 * plugin-provided pending changes, and only once a plugin says it adopts the template: without one
 * the screen ends before the template shows. Returns the adoption, or undefined when nothing is covered.
 */
export function startTemplateAdoption(): TemplateAdoption | undefined {
  if (!isPendingChangesEnabled()) {
    return undefined;
  }
  endTemplateAdoption();
  const adoption: TemplateAdoption = { startedAt: Date.now() };
  const end = () => endTemplateAdoption(adoption);
  const timer = setTimeout(end, TEMPLATE_ADOPTION_TIMEOUT_MS);
  // Leaving for any other page ends it: Back to where the user started, the mobile redirect away
  // from edit mode, or a link elsewhere.
  const unlisten = locationService.getHistory().listen((location) => {
    if (!isAdoptionPage(location.pathname, location.search)) {
      end();
    }
  });
  stopWatching = () => {
    clearTimeout(timer);
    unlisten();
  };
  current = adoption;
  notify();
  void askAdopters(end).then((adopts) => {
    if (!adopts) {
      end();
    }
  });
  return adoption;
}

/** Ends the screen: only `adoption`'s, when given, so a late end of an earlier one leaves a newer one. */
export function endTemplateAdoption(adoption?: TemplateAdoption): void {
  if (!current || (adoption && adoption !== current)) {
    return;
  }
  current = undefined;
  stopWatching?.();
  stopWatching = undefined;
  notify();
}

/** Whether a registered plugin adopts the template; one that fails, throws or hangs doesn't. */
async function askAdopters(onSettled: () => void): Promise<boolean> {
  try {
    const adopters = await getAdopters();
    const answers = await Promise.all(adopters.map((adopter) => ask(adopter, onSettled)));
    return answers.some(Boolean);
  } catch {
    return false;
  }
}

async function ask(adopter: TemplateAdopter, onSettled: () => void): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ADOPTER_TIMEOUT_MS);
  });
  try {
    // Called inside the promise chain so a synchronous throw is handled like a rejection.
    return (await Promise.race([Promise.resolve().then(() => adopter({ onSettled })), timeout])) === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The registered adopters. Loads the plugins that declare one (plugin.json addedFunctions) first,
 * as the pending changes loaders do.
 */
async function getAdopters(): Promise<TemplateAdopter[]> {
  const pluginIds = await getExtensionPointPluginDependencies(TEMPLATE_ADOPTION_EXTENSION_POINT);
  if (pluginIds.length === 0) {
    return [];
  }
  await preloadPlugins(await getAppPluginConfigs(pluginIds));
  const { addedFunctionsRegistry } = await getPluginExtensionRegistries();
  const state = await addedFunctionsRegistry.getState();
  return (state[TEMPLATE_ADOPTION_EXTENSION_POINT] ?? []).flatMap((item) => (isAdopter(item.fn) ? [item.fn] : []));
}

function isAdopter(fn: unknown): fn is TemplateAdopter {
  return typeof fn === 'function';
}
