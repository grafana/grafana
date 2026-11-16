import { ProviderEvents } from '@openfeature/react-sdk';

import { generateUUID } from '@grafana/data';
import { faro } from '@grafana/faro-web-sdk';
import { reportInteraction } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type VizPanel } from '@grafana/scenes';

import { type PanelEditor } from '../../../PanelEditor';
import { type PanelDataPaneNext } from '../../PanelDataPaneNext';

import {
  type QueryCoauthoringAPI,
  type QueryCoauthoringEntryRequest,
  type QueryCoauthoringSession,
  type QueryCoauthoringState,
  type QueryCoauthoringTarget,
} from './queryCoauthoringContracts';

interface MountedPanel {
  panel: VizPanel;
  owner: PanelEditor;
  target: Omit<QueryCoauthoringTarget, 'refId'>;
  pane: PanelDataPaneNext;
  supported: Set<string>;
  select: (refId: string) => void;
}

const enterListeners = new Set<(request: QueryCoauthoringEntryRequest) => void>();
const resumeListeners = new Set<(request: { sessionId: string }) => void>();
const subscribers = new Set<() => void>();
let mounted: MountedPanel | undefined;
let session: QueryCoauthoringSession | undefined;
let sessionPanel: VizPanel | undefined;
let focus: string | undefined;
let state: QueryCoauthoringState | undefined;
let pending:
  | { target: QueryCoauthoringTarget; ranges: QueryCoauthoringEntryRequest['ranges']; sessionId: string }
  | undefined;
let stopSession: (() => void) | undefined;
let stopFlags: (() => void) | undefined;
let generation = 0;

export const subscribeToCoauthoring = (listener: () => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};
export function subscribeCoauthoringFlags(listener: () => void) {
  const client = getFeatureFlagClient();
  const events = [ProviderEvents.Ready, ProviderEvents.ConfigurationChanged];
  events.forEach((event) => client.addHandler(event, listener));
  return () => events.forEach((event) => client.removeHandler(event, listener));
}
export const getCoauthoringGeneration = () => generation;
export function publishCoauthoring() {
  generation++;
  subscribers.forEach((listener) => listener());
}
export function isQueryCoauthoringEnabled() {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.QueryeditorCoauthoringUi, false);
}
export function isQueryCoauthoringV2Active() {
  return (
    isQueryCoauthoringEnabled() &&
    getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaVisualDesignRefresh, false) &&
    enterListeners.size > 0
  );
}
export function getCoauthoringSurface(pane?: PanelDataPaneNext) {
  if (pane && mounted?.pane !== pane) {
    return undefined;
  }
  if (!mounted || !mounted.owner.isActive) {
    return undefined;
  }
  const ownsSession = mounted.panel === sessionPanel;
  return {
    ...mounted,
    session: ownsSession ? session : undefined,
    focus: ownsSession ? focus : undefined,
    state: ownsSession ? state : undefined,
  };
}
function track(event: string, sessionId: string, attributes: Record<string, string> = {}) {
  if (event === 'proposal_staged' || event === 'session_opened') {
    reportInteraction(`grafana_query_coauthoring_${event}`, { sessionId, ...attributes }, { silent: true });
  } else {
    reportInteraction(`grafana_query_coauthoring_${event}`, { sessionId, ...attributes });
  }
}
function matches(target: QueryCoauthoringTarget) {
  return (
    mounted?.target.panelId === target.panelId &&
    (target.dashboardUid === undefined || mounted?.target.dashboardUid === target.dashboardUid)
  );
}
export function mountCoauthoringPanel(panel: MountedPanel): () => void {
  mounted = panel;
  publishCoauthoring();
  return () => {
    if (mounted === panel) {
      mounted = undefined;
      pending = undefined;
      publishCoauthoring();
    }
  };
}

export function requestCoauthoringEntry(
  request: QueryCoauthoringEntryRequest,
  source: 'highlight' | 'query_button' | 'debug'
) {
  if (!isQueryCoauthoringV2Active() || !queryCoauthoringApi.canEnter(request.target).ok) {
    return;
  }
  if (session && sessionPanel === mounted?.panel && focus !== request.target.refId) {
    mounted?.pane.closeCoauthoringSession('replaced');
  }
  const sessionId = generateUUID();
  pending = { target: request.target, ranges: request.ranges, sessionId };
  faro.api?.startUserAction('query_coauthoring', { sessionId });
  track('opened_popover', sessionId, { source });
  enterListeners.forEach((listener) => listener(request));
}
export function requestCoauthoringResume() {
  const current = getCoauthoringSurface()?.session;
  if (!current || current.signal.aborted || !isQueryCoauthoringV2Active()) {
    return;
  }
  resumeListeners.forEach((listener) => listener({ sessionId: current.getState().sessionId }));
}

export const queryCoauthoringApi: QueryCoauthoringAPI = {
  version: 1,
  onEnterRequested(listener) {
    enterListeners.add(listener);
    if (!stopFlags) {
      const client = getFeatureFlagClient();
      const update = () => publishCoauthoring();
      client.addHandler(ProviderEvents.ConfigurationChanged, update);
      stopFlags = () => client.removeHandler(ProviderEvents.ConfigurationChanged, update);
    }
    publishCoauthoring();
    return () => {
      enterListeners.delete(listener);
      if (!enterListeners.size) {
        stopFlags?.();
        stopFlags = undefined;
        pending = undefined;
      }
      publishCoauthoring();
    };
  },
  onResumeRequested(listener) {
    resumeListeners.add(listener);
    return () => {
      resumeListeners.delete(listener);
    };
  },
  canEnter(target) {
    if (!isQueryCoauthoringV2Active() || !matches(target) || !mounted?.owner.isActive) {
      return { ok: false, reason: 'not_in_panel_edit' };
    }
    const queries = mounted.pane.getCoauthoringEditorQueries() ?? [];
    if (!queries.some((query) => query.refId === target.refId)) {
      return { ok: false, reason: 'unknown_query' };
    }
    return mounted.supported.has(target.refId) ? { ok: true } : { ok: false, reason: 'unsupported_datasource' };
  },
  async enter(target) {
    const check = queryCoauthoringApi.canEnter(target);
    if (!check.ok || !mounted) {
      throw new Error(`Query coauthoring unavailable: ${check.ok ? 'not_in_panel_edit' : check.reason}`);
    }
    const request = pending && matches(pending.target) && pending.target.refId === target.refId ? pending : undefined;
    pending = undefined;
    const { pane, panel } = mounted;
    const next = pane.startCoauthoringSession(
      target.refId,
      request?.ranges,
      (refId) => {
        if (mounted?.panel === panel) {
          mounted.select(refId);
        }
      },
      request?.sessionId
    );
    stopSession?.();
    session = next;
    sessionPanel = panel;
    focus = target.refId;
    let previous: QueryCoauthoringState | undefined;
    stopSession = next.subscribe((snapshot) => {
      state = snapshot;
      if (snapshot.proposal?.length && snapshot.proposal[0].id !== previous?.proposal?.[0]?.id) {
        track('proposal_staged', snapshot.sessionId);
      }
      for (const option of snapshot.proposal ?? []) {
        if (
          option.previewOutcome &&
          option.previewOutcome !== 'loading' &&
          option.previewOutcome !== previous?.proposal?.find((old) => old.id === option.id)?.previewOutcome
        ) {
          track('preview_outcome_shown', snapshot.sessionId, { kind: option.previewOutcome });
        }
      }
      previous = snapshot;
      publishCoauthoring();
    });
    const stopSessionFlags = subscribeCoauthoringFlags(() => {
      if (!isQueryCoauthoringEnabled()) {
        pane.closeCoauthoringSession('flag_off');
      }
    });
    next.signal.addEventListener(
      'abort',
      () => {
        stopSessionFlags();
        if (session === next) {
          session = undefined;
          sessionPanel = undefined;
          state = undefined;
          focus = undefined;
          stopSession?.();
          stopSession = undefined;
          publishCoauthoring();
        }
      },
      { once: true }
    );
    void next.closed.then((reason) => track('dismissed_popover', next.getState().sessionId, { reason }));
    track('session_opened', next.getState().sessionId);
    return {
      version: next.version,
      signal: next.signal,
      closed: next.closed,
      getState: next.getState,
      subscribe: next.subscribe,
      stageProposal: next.stageProposal,
      preview(optionId) {
        const changed = next.getState().previewedOption !== optionId;
        const result = next.preview(optionId);
        if (result.ok && changed) {
          track('option_selected', next.getState().sessionId);
        }
        return result;
      },
      async accept(optionId, options) {
        const result = await next.accept(optionId, options);
        if (result.status === 'applied') {
          track('accepted_proposal', next.getState().sessionId);
        }
        return result;
      },
      async undo(options) {
        const result = await next.undo(options);
        if (result.status === 'applied') {
          track('undone_proposal', next.getState().sessionId);
        }
        return result;
      },
      select: next.select,
      exit: next.exit,
    } satisfies QueryCoauthoringSession;
  },
};
