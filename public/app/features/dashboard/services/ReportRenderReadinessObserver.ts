import { LoadingState } from '@grafana/data';
import { sceneGraph, VizPanel, type SceneObject, type performanceUtils } from '@grafana/scenes';

import { registerPerformanceObserver } from './performanceUtils';

interface MessageEventPayloadMap {
  REPORT_RENDER_COMPLETE: { success: boolean };
}

type MessageEventType = keyof MessageEventPayloadMap;

interface RenderBindingMessage<T extends MessageEventType> {
  type: T;
  data: MessageEventPayloadMap[T];
}

export const READINESS_POLL_INTERVAL_MS = 250;
// Last-resort safety-net timeout for panels that can never reach a terminal data state
// (misbehaving plugin, panel stuck in a loading loop): degrade to signalling anyway and
// let the renderer capture what is there, instead of running into its own longer timeout.
export const READINESS_TIMEOUT_MS = 30000;
// Subtracted from the renderer-advertised budget so our signal lands (and the capture
// happens) before the renderer gives up on its side.
export const RENDERER_BUDGET_MARGIN_MS = 5000;
const MIN_READINESS_TIMEOUT_MS = 5000;

/**
 * Resolves the safety-net timeout from the readiness budget the image renderer injects
 * into the page it captures (`browser.readiness.timeout` on the renderer), minus a
 * margin so the signal is sent before the renderer gives up on its side. Falls back to
 * a hardcoded value matching the renderer's default readiness timeout when the renderer
 * does not advertise its budget (older renderers).
 */
export function getReadinessTimeoutMs(): number {
  const rendererBudget = window.__grafanaImageRendererReadinessTimeoutMs;
  if (typeof rendererBudget === 'number' && rendererBudget > 0) {
    return Math.max(rendererBudget - RENDERER_BUDGET_MARGIN_MS, MIN_READINESS_TIMEOUT_MS);
  }

  return READINESS_TIMEOUT_MS;
}

/**
 * Performance observer that signals to the grafana-image-renderer when a dashboard
 * has finished rendering all panels for report capture.
 *
 * Sends a `REPORT_RENDER_COMPLETE` message via the `window.__grafanaImageRendererMessageChannel`
 * chromedp binding when a `dashboard_view` interaction completes, meaning all panels have gone
 * through the full lifecycle (queries, transforms, field config, rendering).
 *
 * The `dashboard_view` interaction completes when the running-query count drains to zero,
 * which with repeat panels happens *before* the freshly materialized clones register their
 * queries. When a scene is attached, the message is therefore additionally gated on scene
 * state: it is only sent once every active panel holds terminal data. Polling is required
 * because `dashboard_view` fires only once — no further interaction event follows when the
 * repeat panels' queries settle.
 *
 * This observer is only registered for report routes to avoid any overhead on
 * normal dashboard usage.
 */
export class ReportRenderReadinessObserver implements performanceUtils.ScenePerformanceObserver {
  private scene: SceneObject | null = null;
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  /**
   * Scene whose panels must display their data before the readiness signal is sent.
   * Without a scene the observer falls back to signalling as soon as the
   * `dashboard_view` interaction completes.
   */
  public setScene(scene: SceneObject | null): void {
    this.stopPolling();
    this.scene = scene;
  }

  onDashboardInteractionComplete = (data: performanceUtils.DashboardInteractionCompleteData): void => {
    if (data.interactionType === 'dashboard_view') {
      this.sendWhenSceneReady();
    }
  };

  private sendWhenSceneReady(): void {
    this.stopPolling();

    const scene = this.scene;
    if (!scene || isSceneReadyForCapture(scene)) {
      sendMessageEvent('REPORT_RENDER_COMPLETE', { success: true });
      return;
    }

    const deadline = Date.now() + getReadinessTimeoutMs();
    this.pollHandle = setInterval(() => {
      const timedOut = Date.now() >= deadline;
      if (timedOut || isSceneReadyForCapture(scene)) {
        this.stopPolling();
        if (timedOut) {
          console.warn(
            'ReportRenderReadinessObserver: panels still without terminal data after timeout, signalling render completion anyway'
          );
        }
        sendMessageEvent('REPORT_RENDER_COMPLETE', { success: true });
      }
    }, READINESS_POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }
}

/**
 * True when every active panel displays its data, so a capture would not contain
 * loading skeletons. Only active (mounted) panels are considered: panels that never
 * activate — inside collapsed rows or inactive tabs — must not block the capture.
 * Repeat clones are mounted eagerly on render targets (lazy loading is disabled
 * during capture), so a clone whose query has not settled yet is an active panel
 * without terminal data and keeps this predicate false.
 */
function isSceneReadyForCapture(scene: SceneObject): boolean {
  const variables = scene.state.$variables?.state.variables ?? [];
  if (variables.some((variable) => variable.state.loading)) {
    return false;
  }

  const activePanels = sceneGraph
    .findAllObjects(scene, (obj) => obj instanceof VizPanel && obj.isActive)
    .filter((obj): obj is VizPanel => obj instanceof VizPanel);

  return activePanels.every(displaysData);
}

function displaysData(panel: VizPanel): boolean {
  const provider = panel.state.$data;
  if (!provider) {
    // No data provider (text panel, dashboard list, ...) — nothing to wait for
    return true;
  }

  const state = provider.state.data?.state;
  return state === LoadingState.Done || state === LoadingState.Error || state === LoadingState.Streaming;
}

let instance: ReportRenderReadinessObserver | null = null;

export function initializeReportRenderReadinessObserver(scene?: SceneObject): void {
  if (!instance) {
    instance = new ReportRenderReadinessObserver();
    registerPerformanceObserver(instance, 'RRO');
  }

  // The singleton survives navigation between dashboards — always point it at the
  // scene of the current load
  instance.setScene(scene ?? null);
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
