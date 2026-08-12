import { type Unsubscribable } from 'rxjs';

import {
  NewSceneObjectAddedEvent,
  type SceneObject,
  SceneObjectStateChangedEvent,
  VizPanel,
  type performanceUtils,
  sceneGraph,
} from '@grafana/scenes';
import { isDashboardRenderReady } from 'app/features/dashboard-scene/behaviors/DashboardRenderReadiness';

import { getDashboardSceneProfiler } from './DashboardProfiler';
import { registerPerformanceObserver } from './performanceUtils';

interface MessageEventPayloadMap {
  REPORT_RENDER_COMPLETE: { success: boolean };
}

type MessageEventType = keyof MessageEventPayloadMap;

interface RenderBindingMessage<T extends MessageEventType> {
  type: T;
  data: MessageEventPayloadMap[T];
}

/**
 * Performance observer that signals to the grafana-image-renderer when a dashboard
 * has finished rendering all panels for report capture.
 *
 * Sends a `REPORT_RENDER_COMPLETE` message via the `window.__grafanaImageRendererMessageChannel`
 * chromedp binding when a `dashboard_view` interaction completes, meaning all panels have gone
 * through the full lifecycle (queries, transforms, field config, rendering).
 *
 * The interaction alone is not sufficient because repeated panels can be added
 * after its fixed trailing window starts. The observer also requires the repeat
 * structure to match current variable values, every expected clone to be active,
 * no panel operations to be in flight, and every active panel to have completed
 * a render after its latest operation.
 *
 * This observer is only registered for report routes to avoid any overhead on
 * normal dashboard usage.
 */
export class ReportRenderReadinessObserver implements performanceUtils.ScenePerformanceObserver {
  private _dashboard?: SceneObject;
  private _sceneSubscriptions: Unsubscribable[] = [];
  private _pendingInteractionComplete = false;
  private _activePanelOperations = new Map<string, string>();
  private _renderedPanelKeys = new Set<string>();
  private _trackedPanelKeys = new Set<string>();
  private _trackedPanels = new WeakSet<VizPanel>();
  private _frameId: number | null = null;
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;

  public setDashboard(dashboard?: SceneObject): void {
    if (this._dashboard === dashboard) {
      return;
    }

    this._clearDashboardState();
    this._dashboard = dashboard;

    if (!dashboard) {
      return;
    }

    const onSceneChanged = () => {
      this._attachProfilersToNewPanels();
      this._scheduleReadinessCheck();
    };

    this._sceneSubscriptions.push(
      dashboard.subscribeToEvent(SceneObjectStateChangedEvent, onSceneChanged),
      dashboard.subscribeToEvent(NewSceneObjectAddedEvent, onSceneChanged)
    );
    this._attachProfilersToNewPanels();
  }

  onDashboardInteractionComplete = (data: performanceUtils.DashboardInteractionCompleteData): void => {
    if (data.interactionType === 'dashboard_view' && this._dashboard) {
      this._pendingInteractionComplete = true;
      this._scheduleReadinessCheck();
    }
  };

  onPanelOperationStart = (data: performanceUtils.PanelPerformanceData): void => {
    if (!this._trackedPanelKeys.has(data.panelKey)) {
      return;
    }

    this._activePanelOperations.set(data.operationId, data.panelKey);
    this._renderedPanelKeys.delete(data.panelKey);
  };

  onPanelOperationComplete = (data: performanceUtils.PanelPerformanceData): void => {
    if (!this._trackedPanelKeys.has(data.panelKey)) {
      return;
    }

    this._activePanelOperations.delete(data.operationId);
    if (data.operation === 'render') {
      this._renderedPanelKeys.add(data.panelKey);
    }
    this._scheduleReadinessCheck();
  };

  private _attachProfilersToNewPanels(): void {
    if (!this._dashboard) {
      return;
    }

    const profiler = getDashboardSceneProfiler();
    const panels = sceneGraph
      .findAllObjects(this._dashboard, (obj) => obj instanceof VizPanel)
      .filter((obj): obj is VizPanel => obj instanceof VizPanel);
    const currentPanelKeys = new Set(
      panels.map((panel) => panel.state.key).filter((key): key is string => Boolean(key))
    );
    this._trackedPanelKeys = currentPanelKeys;

    for (const panel of panels) {
      if (this._trackedPanels.has(panel)) {
        continue;
      }

      this._trackedPanels.add(panel);
      if (panel.state.key) {
        // A newly cloned/replaced panel must complete its own render even when
        // it reuses a key that was previously rendered.
        this._renderedPanelKeys.delete(panel.state.key);
      }
      profiler.attachProfilerToPanel(panel);
    }

    for (const [operationId, panelKey] of this._activePanelOperations) {
      if (!currentPanelKeys.has(panelKey)) {
        this._activePanelOperations.delete(operationId);
      }
    }
    for (const panelKey of this._renderedPanelKeys) {
      if (!currentPanelKeys.has(panelKey)) {
        this._renderedPanelKeys.delete(panelKey);
      }
    }
  }

  private _scheduleReadinessCheck(): void {
    if (!this._pendingInteractionComplete) {
      return;
    }

    this._cancelScheduledCheck();
    this._frameId = requestAnimationFrame(() => {
      this._frameId = null;
      this._timeoutId = setTimeout(() => {
        this._timeoutId = null;
        this._maybeSendRenderComplete();
      }, 0);
    });
  }

  private _maybeSendRenderComplete(): void {
    if (
      !this._pendingInteractionComplete ||
      !this._dashboard ||
      this._activePanelOperations.size > 0 ||
      !isDashboardRenderReady(this._dashboard, this._renderedPanelKeys)
    ) {
      return;
    }

    this._pendingInteractionComplete = false;
    sendMessageEvent('REPORT_RENDER_COMPLETE', { success: true });
  }

  private _clearDashboardState(): void {
    for (const subscription of this._sceneSubscriptions) {
      subscription.unsubscribe();
    }
    this._sceneSubscriptions = [];
    this._cancelScheduledCheck();
    this._dashboard = undefined;
    this._pendingInteractionComplete = false;
    this._activePanelOperations.clear();
    this._renderedPanelKeys.clear();
    this._trackedPanelKeys.clear();
    this._trackedPanels = new WeakSet<VizPanel>();
  }

  private _cancelScheduledCheck(): void {
    if (this._frameId !== null) {
      cancelAnimationFrame(this._frameId);
      this._frameId = null;
    }
    if (this._timeoutId !== null) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }
}

let instance: ReportRenderReadinessObserver | null = null;

export function initializeReportRenderReadinessObserver(dashboard?: SceneObject): void {
  if (!instance) {
    instance = new ReportRenderReadinessObserver();
    registerPerformanceObserver(instance, 'RRO');
  }

  if (dashboard) {
    instance.setDashboard(dashboard);
  }
}

export function clearReportRenderReadinessObserver(): void {
  instance?.setDashboard(undefined);
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
