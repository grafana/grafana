import { type DataSourceRef } from '@grafana/data';

/**
 * @internal
 */
export const ExpressionDatasourceRef = Object.freeze({
  type: '__expr__',
  uid: '__expr__',
  name: 'Expression',
});

/**
 * @public
 */
export function isExpressionReference(ref?: DataSourceRef | string | null): boolean {
  if (!ref) {
    return false;
  }
  const v = typeof ref === 'string' ? ref : ref.type;
  return v === ExpressionDatasourceRef.type || v === ExpressionDatasourceRef.name || v === '-100'; // -100 was a legacy accident that should be removed
}
