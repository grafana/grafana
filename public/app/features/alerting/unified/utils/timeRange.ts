import { RelativeTimeRange } from '@grafana/data';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { ExpressionQuery, ExpressionQueryType } from '../../../expressions/types';

const FALL_BACK_TIME_RANGE = { from: 21600, to: 0 };

export const getTimeRangeForExpression = (query: ExpressionQuery, queries: AlertQuery[]): RelativeTimeRange => {
  const referencedRefIds: string[] | undefined = getReferencedIds(query, queries);

  if (!referencedRefIds) {
    return FALL_BACK_TIME_RANGE;
  }

  const { from, to } = getTimeRanges(referencedRefIds, queries);

  if (!from.length && !to.length) {
    return FALL_BACK_TIME_RANGE;
  }

  return {
    from: Math.max(...from),
    to: Math.min(...to),
  };
};

const getReferencedIds = (model: ExpressionQuery, queries: AlertQuery[]): string[] | undefined => {
  switch (model.type) {
    case ExpressionQueryType.classic:
      return getReferencedIdsForClassicCondition(model);
    case ExpressionQueryType.math:
      return getReferencedIdsForMath(model, queries);
    case ExpressionQueryType.resample:
    case ExpressionQueryType.reduce:
    case ExpressionQueryType.threshold:
      return getReferencedIdsForReduce(model);
  }
};

const getReferencedIdsForClassicCondition = (model: ExpressionQuery) => {
  return model.conditions?.map((condition) => {
    return condition.query.params[0];
  });
};

const getTimeRanges = (referencedRefIds: string[], queries: AlertQuery[]) => {
  let from: number[] = [];
  let to = [FALL_BACK_TIME_RANGE.to];
  for (const referencedRefIdsKey of referencedRefIds) {
    const query = queries.find((query) => query.refId === referencedRefIdsKey);

    if (!query || !query.relativeTimeRange) {
      continue;
    }
    from.push(query.relativeTimeRange.from);
    to.push(query.relativeTimeRange.to);
  }

  return {
    from,
    to,
  };
};

const getReferencedIdsForMath = (model: ExpressionQuery, queries: AlertQuery[]) => {
  return (
    queries
      // filter queries of type query and filter expression on if it includes any refIds
      .filter((q) => q.queryType === 'query' && model.expression?.includes(q.refId))
      .map((q) => {
        return q.refId;
      })
  );
};

const getReferencedIdsForReduce = (model: ExpressionQuery) => {
  return model.expression ? [model.expression] : undefined;
};
