import { useMemo } from 'react';

import { getDefaultRelativeTimeRange, rangeUtil } from '@grafana/data';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { type SqlExpressionQuery } from '../../types';

import { buildDynamicThreshold } from './buildDynamicThreshold';

export function getSourceQueryKey(inputRefId: string, sourceQuery: AlertQuery | undefined): string {
  return sourceQuery ? `${inputRefId}\0${JSON.stringify(sourceQuery.model)}` : '';
}

// Derived from the source query's own relative range; the alert query runner's expression range can be invalid.
export function useSourceQueryTimeRange(sourceQuery: AlertQuery | undefined) {
  const relativeFrom = sourceQuery?.relativeTimeRange?.from;
  const relativeTo = sourceQuery?.relativeTimeRange?.to;
  return useMemo(() => {
    const isValid =
      typeof relativeFrom === 'number' &&
      typeof relativeTo === 'number' &&
      Number.isFinite(relativeFrom) &&
      Number.isFinite(relativeTo) &&
      relativeFrom >= relativeTo;
    return rangeUtil.relativeToTimeRange(
      isValid ? { from: relativeFrom, to: relativeTo } : getDefaultRelativeTimeRange()
    );
  }, [relativeFrom, relativeTo]);
}

/**
 * True when the saved SQL cannot be reproduced by recompiling the saved policy.
 * An empty expression is a policy that has not produced SQL yet, not a mismatch.
 */
export function hasDynamicThresholdSqlMismatch(query: SqlExpressionQuery): boolean {
  if (!query.dynamicThreshold || !query.expression) {
    return false;
  }
  const built = buildDynamicThreshold(query.dynamicThreshold.policy);
  return !built.ok || built.expressionSql !== query.expression;
}

export function withoutDynamicThreshold(query: SqlExpressionQuery): SqlExpressionQuery {
  const { dynamicThreshold: _dynamicThreshold, ...rest } = query;
  return rest;
}
