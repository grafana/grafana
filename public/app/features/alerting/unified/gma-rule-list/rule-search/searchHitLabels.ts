import { type Labels } from 'app/types/unified-alerting-dto';

import { GRAFANA_ORIGIN_LABEL, isPrivateLabelKey } from '../../utils/labels';

/**
 * Converts the search API's flat label strings ("key" and "key=value") into a Labels object.
 * Ignores key-only entries (used for filter matching) and private label keys.
 */
export function parseSearchLabels(entries?: string[]): Labels | undefined {
  if (entries === undefined || entries.length === 0) {
    return undefined;
  }
  const result: Labels = {};
  for (const entry of entries) {
    const indexPosition = entry.indexOf('=');
    if (indexPosition > 0) {
      const key = entry.slice(0, indexPosition);
      if (!isPrivateLabelKey(key)) {
        result[key] = entry.slice(indexPosition + 1);
      }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** The raw plugin origin label, which parseSearchLabels drops as private. */
export function findOriginLabel(entries?: string[]): string | undefined {
  const prefix = `${GRAFANA_ORIGIN_LABEL}=`;
  return entries?.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
}
