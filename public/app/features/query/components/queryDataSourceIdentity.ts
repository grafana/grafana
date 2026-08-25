import { type DataSourceInstanceSettings, type ScopedVars } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

/**
 * First value of a multi-value template variable. Same formatter as
 * `variableInterpolation` in the datasource settings/srv paths.
 */
function firstVariableValue<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Sync identity for the datasource a query row should show. Used during render so a
 * datasource (or variable) change can hide the plugin editor on this paint.
 *
 * `QueryEditorRows` calls this without `fallback`; `QueryEditorRow` passes the group's
 * instance settings so a query with no ref still has a stable identity.
 */
export function getQueryDataSourceIdentity(
  datasource: DataQuery['datasource'],
  scopedVars?: ScopedVars,
  fallback?: DataSourceInstanceSettings
): string | undefined {
  const uid = typeof datasource === 'string' ? datasource : datasource?.uid;
  if (!uid) {
    return fallback?.rawRef?.uid ?? fallback?.uid;
  }
  return uid.includes('$') ? getTemplateSrv().replace(uid, scopedVars, firstVariableValue) : uid;
}
