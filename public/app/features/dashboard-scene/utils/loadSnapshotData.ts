import { firstValueFrom } from 'rxjs';
import { filter, timeout } from 'rxjs/operators';

import { LoadingState } from '@grafana/data';
import { type CancelActivationHandler, type SceneDataProvider, type SceneObject, type VizPanel } from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';

// A single stuck datasource shouldn't be able to keep the snapshot spinner up forever, so bound
// both how long we wait for any one panel and the whole load. Whatever hasn't loaded when the
// overall budget runs out is serialized with its (empty) data, matching pre-fix behavior.
const PER_PANEL_TIMEOUT_MS = 15_000;
const OVERALL_TIMEOUT_MS = 30_000;

// Query runners that derive maxDataPoints from panel width skip execution until they are given a
// container width, which normally happens when the panel renders. Panels we activate here were
// never rendered, so we hand them a nominal width to unblock (and kick off) their queries. The
// exact value only affects data resolution, not correctness.
const NOMINAL_CONTAINER_WIDTH = 1000;

export interface LoadSnapshotDataResult {
  totalPanels: number;
  timedOutPanels: number;
}

export interface LoadSnapshotDataOptions {
  perPanelTimeoutMs?: number;
  overallTimeoutMs?: number;
}

// A settled provider is one whose data is worth capturing in the snapshot. Streaming panels never
// reach Done, but they do have data, so treat Streaming as settled — otherwise they would always
// hit the timeout, delaying every snapshot and firing a spurious warning.
function isSettled(state?: LoadingState): boolean {
  return state === LoadingState.Done || state === LoadingState.Error || state === LoadingState.Streaming;
}

/**
 * Force-activates every VizPanel in the dashboard — including panels in hidden tabs, collapsed
 * rows and off-screen lazy panels that were never mounted — so their query runners execute, then
 * waits for each to reach a settled state before returning. Snapshot serialization reads whatever
 * data currently sits in each panel's data provider, so without this those panels would serialize
 * empty ("No data"). Everything this activates is deactivated again before returning, so the live
 * dashboard is left untouched.
 */
export async function loadSnapshotData(
  dashboard: DashboardScene,
  options: LoadSnapshotDataOptions = {}
): Promise<LoadSnapshotDataResult> {
  const perPanelTimeoutMs = options.perPanelTimeoutMs ?? PER_PANEL_TIMEOUT_MS;
  const overallTimeoutMs = options.overallTimeoutMs ?? OVERALL_TIMEOUT_MS;

  const cancelHandlers: CancelActivationHandler[] = [];
  const activatedPanels = new Set<VizPanel>();

  const activateIfInactive = (panel: VizPanel) => {
    if (!panel.isActive) {
      activatedPanels.add(panel);
      const cancel = forceActivateFullSceneObjectTree(panel);
      if (cancel) {
        cancelHandlers.push(cancel);
      }
    }
  };

  try {
    // First pass activates repeaters, which populate their `repeatedPanels` clones synchronously.
    for (const panel of dashboard.getDashboardPanels()) {
      activateIfInactive(panel);
    }

    // Re-enumerate to pick up the repeat clones created during the first pass and activate them.
    const panels = dashboard.getDashboardPanels();
    for (const panel of panels) {
      activateIfInactive(panel);
    }

    // Only the panels we just activated were never rendered and so need a container width to run
    // their queries. Live panels already have one — leave them untouched.
    for (const panel of activatedPanels) {
      panel.state.$data?.setContainerWidth?.(NOMINAL_CONTAINER_WIDTH);
    }

    // Each entry flips to true once its panel's data settles. A per-panel timeout bounds every
    // wait, and the overall timeout is a backstop that returns whatever has settled so far — any
    // panel still marked false is reported as timed out.
    const loaded: boolean[] = new Array(panels.length).fill(false);
    const waits = panels.map((panel, index) =>
      waitForPanelData(panel.state.$data, perPanelTimeoutMs).then((didLoad) => {
        loaded[index] = didLoad;
      })
    );
    await withOverallTimeout(Promise.all(waits), overallTimeoutMs);

    const timedOutPanels = loaded.filter((didLoad) => !didLoad).length;
    return { totalPanels: panels.length, timedOutPanels };
  } finally {
    // Deactivate only what we activated, unwinding in reverse so children go before their parents.
    for (const cancel of cancelHandlers.reverse()) {
      cancel();
    }
  }
}

/**
 * Resolves true once the provider's data settles, or false if it doesn't within the timeout.
 * Panels without a data provider (rows, text panels, panels with no query) are treated as loaded
 * immediately.
 */
async function waitForPanelData(provider: SceneDataProvider | undefined, timeoutMs: number): Promise<boolean> {
  if (!provider) {
    return true;
  }

  if (isSettled(provider.state.data?.state)) {
    return true;
  }

  try {
    await firstValueFrom(
      provider.getResultsStream().pipe(
        filter(({ data }) => isSettled(data.state)),
        timeout(timeoutMs)
      )
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Races the given promise against a timer that resolves (rather than rejects), so the caller's
 * cleanup always runs and we can still serialize whatever data managed to load in time. The timer
 * is cleared once the race settles so it doesn't linger when the work finishes first.
 */
function withOverallTimeout(promise: Promise<unknown>, timeoutMs: number): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Activates a scene object and its full ancestor chain, returning a handler that deactivates
 * everything this activated (no-op for nodes that were already active).
 *
 * Inlined from utils/utils.ts (rather than imported) to keep this module free of dashboard-scene
 * runtime imports, which would otherwise close a circular dependency back through ShareSnapshotTab.
 * Same approach as utils/getVizSuggestionForQuery.ts.
 */
function forceActivateFullSceneObjectTree(so: SceneObject): CancelActivationHandler | undefined {
  const parentCancel = so.parent ? forceActivateFullSceneObjectTree(so.parent) : undefined;
  const cancel = so.isActive ? undefined : so.activate();

  return () => {
    parentCancel?.();
    cancel?.();
  };
}
