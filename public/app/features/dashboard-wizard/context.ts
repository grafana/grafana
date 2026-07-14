import { type ChatContextItem } from '@grafana/assistant';

import { type WizardDatasource } from './types';

/**
 * Helpers for the context items the user attaches through the assistant's
 * context picker (datasources, metrics, labels, dashboards, …).
 *
 * The picker returns `ChatContextItem`s whose `node.data` carries a
 * `formatForLLM()` method — the same serialization the assistant chat sends
 * with every message. The instances are created inside the plugin bundle, so
 * everything here duck-types instead of using `instanceof` against this
 * bundle's copy of the SDK classes.
 */

interface FormattedContextItem {
  type: string;
  data: Record<string, unknown>;
}

function formatItem(item: ChatContextItem): FormattedContextItem | undefined {
  const data: unknown = item.node.data;
  if (
    typeof data !== 'object' ||
    data === null ||
    !('formatForLLM' in data) ||
    typeof data.formatForLLM !== 'function'
  ) {
    return undefined;
  }

  try {
    const formatted: unknown = data.formatForLLM();
    if (
      typeof formatted === 'object' &&
      formatted !== null &&
      'type' in formatted &&
      typeof formatted.type === 'string' &&
      'data' in formatted &&
      typeof formatted.data === 'object' &&
      formatted.data !== null
    ) {
      return { type: formatted.type, data: { ...formatted.data } };
    }
  } catch {
    // A context item that fails to serialize is simply omitted.
  }
  return undefined;
}

/**
 * Serializes the selected context items into a prompt block, one line per
 * item, in the same `{type, data}` shape the assistant chat uses. Returns ''
 * when nothing serializes.
 */
export function formatContextItemsForPrompt(items: ChatContextItem[]): string {
  const lines: string[] = [];
  for (const item of items) {
    const formatted = formatItem(item);
    if (formatted) {
      lines.push(`- ${item.node.name} (${formatted.type}): ${JSON.stringify(formatted.data)}`);
    }
  }
  return lines.join('\n');
}

/**
 * Datasources the user explicitly attached as context. When non-empty, the
 * wizard scopes its suggestions and the build to exactly these.
 */
export function getContextDatasourceUids(items: ChatContextItem[]): string[] {
  const uids: string[] = [];
  for (const item of items) {
    const formatted = formatItem(item);
    if (formatted?.type === 'datasource' && typeof formatted.data.uid === 'string') {
      uids.push(formatted.data.uid);
    }
  }
  return uids;
}

/**
 * Applies explicit datasource context to the full datasource list: when the
 * user attached specific datasources, only those are offered to the
 * assistant; otherwise the full list stays in play.
 */
export function scopeDatasourcesToContext(
  datasources: WizardDatasource[],
  contextItems: ChatContextItem[]
): WizardDatasource[] {
  const uids = new Set(getContextDatasourceUids(contextItems));
  if (uids.size === 0) {
    return datasources;
  }
  const scoped = datasources.filter((ds) => uids.has(ds.uid));
  return scoped.length > 0 ? scoped : datasources;
}
