import { type InterpolateFunction } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { MAX_VARIABLES, MAX_VARIABLE_VALUES } from './constants';
import { type VariableSnapshot } from './protocol';

/**
 * Resolves the dashboard variables through the panel's own replaceVariables, so scoped
 * values (repeats) win over the dashboard-wide ones.
 */
export function snapshotVariables(replaceVariables: InterpolateFunction): VariableSnapshot {
  const snapshot: VariableSnapshot = {};
  const variables = getTemplateSrv().getVariables().slice(0, MAX_VARIABLES);
  for (const variable of variables) {
    const name = variable.name;
    if (!name || Object.prototype.hasOwnProperty.call(snapshot, name)) {
      continue;
    }
    const raw = replaceVariables(`\${${name}:json}`);
    snapshot[name] = {
      value: toSnapshotValue(parseJson(raw)),
      text: toSnapshotValue(replaceVariables(`\${${name}:text}`)),
    };
  }
  return snapshot;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function toSnapshotValue(value: unknown): string | string[] {
  if (Array.isArray(value)) {
    return value.slice(0, MAX_VARIABLE_VALUES).map(toText);
  }
  return toText(value);
}

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
