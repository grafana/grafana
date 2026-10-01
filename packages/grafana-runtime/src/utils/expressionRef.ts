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
  if (typeof ref === 'string') {
    return isExpressionValue(ref);
  }
  // Check the uid as well as the type: dashboards exist with refs like `{uid: '__expr__'}`
  // that carry no type, which the legacy DataSourceSrv resolves by uid alone.
  return isExpressionValue(ref.type) || isExpressionValue(ref.uid);
}

function isExpressionValue(value: string | undefined): boolean {
  return (
    value === ExpressionDatasourceRef.type || value === ExpressionDatasourceRef.name || value === '-100' // -100 was a legacy accident that should be removed
  );
}
