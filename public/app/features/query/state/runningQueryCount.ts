import { CoreApp, DataQueryRequest, DataQueryResponse, LoadingState } from '@grafana/data';

type PanelKey = number;

type PanelState = {
  incomplete: boolean;
  activeRequests: Set<string>;
};

type RequestState = {
  requestId: string;
  panelId: PanelKey;
  expectedQueries: number;
  seenKeys: Set<string>;
  completedKeys: Set<string>;
  panelCompleted: boolean;
};

const isBrowser = typeof window !== 'undefined';
let runningQueryCount = 0;
let panelStates = new Map<PanelKey, PanelState>();
let requestStates = new Map<string, RequestState>();
let propertyDefined = false;
let useDirectAssignment = false;

function ensureGlobalProperty() {
  if (!isBrowser || propertyDefined) {
    return;
  }

  const existing = Object.getOwnPropertyDescriptor(window, '__grafanaRunningQueryCount');
  if (existing?.get && existing?.set) {
    propertyDefined = true;
    return;
  }

  try {
    Object.defineProperty(window, '__grafanaRunningQueryCount', {
      configurable: true,
      get: () => runningQueryCount,
      set: () => {
        // Ignore external writes; we manage the counter explicitly.
      },
    });
    propertyDefined = true;
  } catch (err) {
    useDirectAssignment = true;
    propertyDefined = true;
  }
}

function syncWindowCount() {
  if (!isBrowser || !useDirectAssignment) {
    return;
  }

  window.__grafanaRunningQueryCount = runningQueryCount;
}

function setCount(next: number) {
  runningQueryCount = next;
  syncWindowCount();
}

function adjustCount(delta: number) {
  runningQueryCount += delta;
  syncWindowCount();
}

function isDashboardPanelRequest(request: DataQueryRequest): request is DataQueryRequest & { panelId: number } {
  return request.app === CoreApp.Dashboard && typeof request.panelId === 'number';
}

function getPacketKey(packet: DataQueryResponse): string {
  return packet.key ?? packet.data?.[0]?.refId ?? 'A';
}

function isPacketComplete(packet: DataQueryResponse): boolean {
  const state = packet.state ?? LoadingState.Done;
  return state === LoadingState.Done || state === LoadingState.Error || state === LoadingState.Streaming;
}

function markPanelCompleteForRequest(state: RequestState) {
  if (state.panelCompleted) {
    return;
  }

  state.panelCompleted = true;
  const panelState = panelStates.get(state.panelId);
  if (panelState) {
    panelState.activeRequests.delete(state.requestId);
    if (panelState.activeRequests.size === 0 && panelState.incomplete) {
      panelState.incomplete = false;
      adjustCount(-1);
    }
  }
}

function maybeCompleteRequest(state: RequestState) {
  const totalExpected = Math.max(state.expectedQueries, state.seenKeys.size);
  if (state.completedKeys.size >= totalExpected) {
    markPanelCompleteForRequest(state);
  }
}

function ensureRequestActive(state: RequestState) {
  const panelState = panelStates.get(state.panelId);
  if (!panelState) {
    return;
  }

  if (!panelState.incomplete) {
    panelState.incomplete = true;
    adjustCount(1);
  }

  panelState.activeRequests.add(state.requestId);
  state.panelCompleted = false;
}

export function setupRunningQueryCount() {
  ensureGlobalProperty();
}

export function initializeDashboardRunningQueryCount(
  panels: Array<{ id: PanelKey; hasQueries: boolean }>
): void {
  if (!isBrowser) {
    return;
  }

  ensureGlobalProperty();

  panelStates = new Map();
  requestStates = new Map();
  setCount(panels.length);

  for (const panel of panels) {
    panelStates.set(panel.id, { incomplete: true, activeRequests: new Set() });
  }

  for (const panel of panels) {
    if (!panel.hasQueries) {
      const panelState = panelStates.get(panel.id);
      if (panelState && panelState.incomplete && panelState.activeRequests.size === 0) {
        panelState.incomplete = false;
        adjustCount(-1);
      }
    }
  }
}

export function startDashboardRequestTracking(request: DataQueryRequest): boolean {
  if (!isBrowser || !isDashboardPanelRequest(request)) {
    return false;
  }

  ensureGlobalProperty();

  const panelId = request.panelId;
  const requestId = request.requestId;

  let panelState = panelStates.get(panelId);
  if (!panelState) {
    panelState = { incomplete: false, activeRequests: new Set() };
    panelStates.set(panelId, panelState);
  }

  if (!panelState.incomplete) {
    panelState.incomplete = true;
    adjustCount(1);
  }

  panelState.activeRequests.add(requestId);

  const expectedQueries = request.targets.length;
  if (expectedQueries > 0) {
    adjustCount(expectedQueries);
  }

  const requestState: RequestState = {
    requestId,
    panelId,
    expectedQueries,
    seenKeys: new Set(),
    completedKeys: new Set(),
    panelCompleted: false,
  };

  requestStates.set(requestId, requestState);

  if (expectedQueries === 0) {
    maybeCompleteRequest(requestState);
  }

  return true;
}

export function trackDashboardRequestPacket(requestId: string, packet: DataQueryResponse): void {
  const requestState = requestStates.get(requestId);
  if (!requestState) {
    return;
  }

  const key = getPacketKey(packet);
  if (!requestState.seenKeys.has(key)) {
    requestState.seenKeys.add(key);
    if (requestState.seenKeys.size > requestState.expectedQueries) {
      adjustCount(1);
    }

    if (requestState.panelCompleted || !panelStates.get(requestState.panelId)?.activeRequests.has(requestState.requestId)) {
      ensureRequestActive(requestState);
    }
  }

  if (isPacketComplete(packet) && !requestState.completedKeys.has(key)) {
    requestState.completedKeys.add(key);
    adjustCount(-1);
  }

  maybeCompleteRequest(requestState);
}

export function finalizeDashboardRequestTracking(requestId: string): void {
  const requestState = requestStates.get(requestId);
  if (!requestState) {
    return;
  }

  const totalExpected = Math.max(requestState.expectedQueries, requestState.seenKeys.size);
  const remaining = totalExpected - requestState.completedKeys.size;
  if (remaining > 0) {
    adjustCount(-remaining);
  }

  markPanelCompleteForRequest(requestState);
  requestStates.delete(requestId);
}
