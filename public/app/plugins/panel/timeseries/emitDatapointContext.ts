import { type DatapointContextItem } from './buildAssistantContext';

export const DATAPOINT_CONTEXT_MESSAGE_TYPE = 'grafana/datapoint-context';

/** Solo-URL param the host sets to its origin to opt in to receiving context. */
const EMBED_TARGET_PARAM = 'assistantContextTarget';

export interface DatapointContextMessage {
  type: typeof DATAPOINT_CONTEXT_MESSAGE_TYPE;
  version: 1;
  source: 'grafana';
  origin: string;
  context: DatapointContextItem[];
}

/** Origin to post context to when embedded and opted in, else null. */
export function getDatapointEmbedTarget(): string | null {
  if (typeof window === 'undefined' || window.parent === window.self) {
    return null;
  }

  const param = new URLSearchParams(window.location.search).get(EMBED_TARGET_PARAM);
  if (!param) {
    return null;
  }

  // Hosts with an opaque origin (e.g. an MCP-app iframe) opt in with '*'.
  if (param === '*') {
    return '*';
  }

  try {
    return new URL(param).origin;
  } catch {
    return null;
  }
}

export function emitDatapointContextToParent(context: DatapointContextItem[], targetOrigin: string): void {
  const message: DatapointContextMessage = {
    type: DATAPOINT_CONTEXT_MESSAGE_TYPE,
    version: 1,
    source: 'grafana',
    origin: 'grafana/panel-tooltip',
    context,
  };
  window.parent.postMessage(message, targetOrigin);
}
