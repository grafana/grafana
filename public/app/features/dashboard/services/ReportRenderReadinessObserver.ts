import {
  MultiValueVariable,
  sceneGraph,
  SceneGridRow,
  SceneObjectBase,
  VizPanel,
  type performanceUtils,
  type SceneObject,
  type SceneObjectState,
  type SceneVariable,
} from '@grafana/scenes';
import { LoadingState } from '@grafana/schema';
import { type DashboardSceneLike } from 'app/features/dashboard-scene/scene/types/dashboard';

import { registerPerformanceObserver } from './performanceUtils';

interface MessageEventPayloadMap {
  REPORT_RENDER_COMPLETE: { success: boolean };
}

type MessageEventType = keyof MessageEventPayloadMap;

interface RenderBindingMessage<T extends MessageEventType> {
  type: T;
  data: MessageEventPayloadMap[T];
}

export const SETTLE_POLL_INTERVAL_MS = 500;
// Give up waiting and send the "ready" signal after this long. Must stay well below
// the renderer's --browser.readiness.timeout (default 30s), which starts counting
// earlier than we do: if the renderer gives up first, the whole render fails with a
// timeout error instead of producing a report from whatever has loaded so far.
export const SETTLE_MAX_WAIT_MS = 20_000;

/**
 * Duck-typed view of the repeater state fields, avoiding runtime imports from
 * dashboard-scene (import cycle):
 * - DashboardGridItem / AutoGridItem: `variableName` + `body` + `repeatedPanels`
 * - RowRepeaterBehavior:              `variableName` only (clones live as SceneGridRow
 *                                     siblings with `repeatSourceKey` in the layout)
 * - RowItem / TabItem:                `repeatByVariable` + `repeatedRows` / `repeatedTabs`
 */
interface RepeaterLikeState extends SceneObjectState {
  variableName?: string;
  repeatByVariable?: string;
  body?: VizPanel;
  repeatedPanels?: unknown[];
  repeatedRows?: unknown[];
  repeatedTabs?: unknown[];
}

/**
 * Walk descendants of `root` (not `root` itself — matches sceneGraph.findAllObjects)
 * and return true as soon as `pred` matches. Used instead of findAllObjects when the
 * visitor is only a side-effecting pending check.
 */
function sceneSome(root: SceneObject, pred: (obj: SceneObject) => boolean): boolean {
  let hit = false;

  const visit = (obj: SceneObject) => {
    obj.forEachChild((child) => {
      if (hit) {
        return;
      }
      if (pred(child)) {
        hit = true;
        return;
      }
      visit(child);
    });
  };

  visit(root);
  return hit;
}

/** True when this object sits under a default-grid row-repeat clone whose layout is active. */
function isUnderActiveDefaultGridRowClone(panel: SceneObject): boolean {
  for (let obj = panel.parent; obj; obj = obj.parent) {
    if (obj instanceof SceneGridRow && obj.state.repeatSourceKey && obj.parent?.isActive === true) {
      return true;
    }
  }
  return false;
}

/**
 * Default-grid row repeats (RowRepeaterBehavior): clones are inserted into the
 * SceneGridLayout as SceneGridRow siblings with repeatSourceKey. Their clone list
 * is private on the behavior, so we detect the mount gap here instead.
 * Only wait while the parent layout is active — otherwise solo/unmounted layouts
 * would stall until the deadline. Must be checked before any !isActive early-return:
 * clone rows are inactive by definition in this window.
 */
function isUnmountedDefaultGridRowClone(obj: SceneObject): boolean {
  return (
    obj instanceof SceneGridRow && Boolean(obj.state.repeatSourceKey) && obj.parent?.isActive === true && !obj.isActive
  );
}

/**
 * Row/tab clones are created but React has not mounted them yet — their panels sit
 * under inactive nested grid items, invisible to the per-panel data check.
 * Waiting on clone activation cannot stall: row clones mount their header even when
 * collapsed or conditionally hidden (CSS only), and tab clones mount their header in
 * the tabs bar even when not the current tab.
 *
 * Must run before variable checks: performing a row/tab repeat replaces the source
 * row/tab's $variables with a LocalValueVariable shadowing the repeat variable, so
 * once clones exist lookupVariable resolves the shadow (not multi-value) and would
 * skip this repeater entirely.
 */
function hasInactiveRowOrTabClones(state: RepeaterLikeState): boolean {
  const clones = state.repeatedRows ?? state.repeatedTabs;
  if (state.repeatByVariable === undefined || clones === undefined) {
    return false;
  }
  return clones.some((clone) => clone instanceof SceneObjectBase && !clone.isActive);
}

/**
 * The repeat variable is still loading, or it is done but clones have not been
 * created yet — the race window from grafana/grafana#128536. Repeaters never clone
 * for non-multi-value variables. Panel repeaters still clone when the named variable
 * is missing (they synthesize a placeholder CustomVariable), so a null lookup must
 * keep waiting for repeatedPanels. Row/tab repeaters never mount without a real
 * MultiValueVariable, so a missing target must not wait.
 * RowRepeaterBehavior clones are detected via isUnmountedDefaultGridRowClone instead.
 */
function isWaitingForCloneCreation(state: RepeaterLikeState, variable: SceneVariable | null): boolean {
  const isPanelRepeater = state.variableName !== undefined && state.body instanceof VizPanel;
  const isRowOrTabRepeater = state.repeatByVariable !== undefined;

  // Missing variable: panel repeaters still clone; row/tab repeaters never do.
  if (!variable) {
    return isPanelRepeater && state.repeatedPanels === undefined;
  }

  if (!(variable instanceof MultiValueVariable)) {
    return false;
  }

  if (variable.state.loading || sceneGraph.hasVariableDependencyInLoadingState(variable)) {
    return true;
  }

  return (
    (isPanelRepeater && state.repeatedPanels === undefined) ||
    (isRowOrTabRepeater && state.repeatedRows === undefined && state.repeatedTabs === undefined)
  );
}

function isRepeatPending(obj: SceneObject): boolean {
  if (isUnmountedDefaultGridRowClone(obj)) {
    return true;
  }

  // Inactive repeaters (unmounted tab, collapsed row, solo-panel body) never create
  // clones — waiting on them would only stall until the deadline.
  if (!obj.isActive) {
    return false;
  }

  const state: RepeaterLikeState = obj.state;
  const repeatVariableName = state.variableName ?? state.repeatByVariable;
  if (!repeatVariableName) {
    return false;
  }

  const isRowOrTabRepeater = state.repeatByVariable !== undefined;
  const clones = state.repeatedRows ?? state.repeatedTabs;
  if (isRowOrTabRepeater && clones !== undefined) {
    return hasInactiveRowOrTabClones(state);
  }

  return isWaitingForCloneCreation(state, sceneGraph.lookupVariable(repeatVariableName, obj));
}

/**
 * Skip panels that will never mount and thus never produce data: inactive tabs,
 * collapsed rows, solo-panel renders (the /d-solo route mounts a single panel, not
 * the body). A freshly created panel-repeat clone is inactive too, but its owning
 * repeater (parent) is active — keep those, they are exactly the race being fixed.
 * Row/tab clone panels sit under inactive nested grid items and are dropped here;
 * they are guarded by the clone-activation check in isRepeatPending instead.
 * Default-grid row-repeat clones (RowRepeaterBehavior) keep panels under an inactive
 * nested grid item even after the clone row is created — keep those while the layout
 * is active so we wait for their data after the clone mounts.
 */
function isRelevantReportPanel(panel: SceneObject): boolean {
  return panel.isActive || panel.parent?.isActive === true || isUnderActiveDefaultGridRowClone(panel);
}

function isPanelSettled(panel: SceneObject): boolean {
  // Only wait on variables this panel actually depends on (directly or through a
  // chain). A loading-but-unused variable does not block the report.
  if (sceneGraph.hasVariableDependencyInLoadingState(panel)) {
    return false;
  }

  // Queryless panels resolve to Done via the default SceneDataNode. `undefined`
  // means a data provider exists but has not produced data yet (e.g. a freshly
  // created repeat clone that is not mounted) — not settled.
  const dataState = sceneGraph.getData(panel).state.data?.state;
  return dataState === LoadingState.Done || dataState === LoadingState.Error || dataState === LoadingState.Streaming;
}

/**
 * Performance observer that signals to the grafana-image-renderer when a dashboard
 * has finished rendering all panels for report capture.
 *
 * The `dashboard_view` completion event can fire prematurely: when a repeat variable
 * finishes, the running-query count briefly hits 0 before the repeated panels have
 * registered their queries (race described in grafana/grafana#128536). So instead of
 * forwarding the event immediately, we verify the scene has actually settled
 * (no running queries, no pending repeats, all panel data resolved) and poll until
 * it has before sending `REPORT_RENDER_COMPLETE`.
 */
export class ReportRenderReadinessObserver implements performanceUtils.ScenePerformanceObserver {
  #scene: DashboardSceneLike | undefined;
  #pollTimeoutId: ReturnType<typeof setTimeout> | undefined;
  #deadline = 0;

  public setScene(scene: DashboardSceneLike | undefined): void {
    this.#scene = scene;
    this.#cancelPendingPoll();
  }

  public onDashboardInteractionComplete = (data: performanceUtils.DashboardInteractionCompleteData): void => {
    if (data.interactionType !== 'dashboard_view') {
      return;
    }

    this.#cancelPendingPoll();
    this.#deadline = Date.now() + SETTLE_MAX_WAIT_MS;
    this.#sendWhenSettled();
  };

  #sendWhenSettled = (): void => {
    this.#pollTimeoutId = undefined;

    if (this.#isSettled() || Date.now() >= this.#deadline) {
      sendMessageEvent('REPORT_RENDER_COMPLETE', { success: true });
      return;
    }

    this.#pollTimeoutId = setTimeout(this.#sendWhenSettled, SETTLE_POLL_INTERVAL_MS);
  };

  #isSettled(): boolean {
    // Without a scene reference we cannot verify anything; keep old behavior (send immediately).
    if (!this.#scene) {
      return true;
    }

    if ((window.__grafanaRunningQueryCount ?? 0) > 0) {
      return false;
    }

    if (this.#hasPendingRepeat(this.#scene)) {
      return false;
    }

    // getVizPanels() only returns each repeater's source panel. Repeat clones live in
    // repeatedPanels / repeatedRows / repeatedTabs state arrays, which forEachChild
    // traverses, so a full scene-graph walk catches them too.
    const panels = sceneGraph
      .findAllObjects(this.#scene.state.body, (obj) => obj instanceof VizPanel)
      .filter(isRelevantReportPanel);

    return panels.every(isPanelSettled);
  }

  #hasPendingRepeat(scene: DashboardSceneLike): boolean {
    return sceneSome(scene, isRepeatPending);
  }

  #cancelPendingPoll(): void {
    if (this.#pollTimeoutId !== undefined) {
      clearTimeout(this.#pollTimeoutId);
      this.#pollTimeoutId = undefined;
    }
  }
}

let instance: ReportRenderReadinessObserver | null = null;

export function initializeReportRenderReadinessObserver(scene: DashboardSceneLike): void {
  if (!instance) {
    instance = new ReportRenderReadinessObserver();
    registerPerformanceObserver(instance, 'RRO');
  }
  instance.setScene(scene);
}

const createMessageEvent = <T extends MessageEventType>(
  eventType: T,
  data: MessageEventPayloadMap[T]
): RenderBindingMessage<T> => {
  return {
    type: eventType,
    data,
  };
};

const sendMessageEvent = <T extends MessageEventType>(eventType: T, data: MessageEventPayloadMap[T]) => {
  // check if chromedp binding exists. It only takes a string argument.
  if (window.__grafanaImageRendererMessageChannel) {
    window.__grafanaImageRendererMessageChannel(JSON.stringify(createMessageEvent(eventType, data)));
  }
};
