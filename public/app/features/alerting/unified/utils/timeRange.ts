import { RelativeTimeRange } from '@grafana/data';
import { GrafanaExpressionModel, GrafanaQuery } from 'app/types/unified-alerting-dto';
import { ExpressionQueryType } from '../../../expressions/types';

const FALL_BACK_TIME_RANGE = { from: 21600, to: 0 };

export const getTimeRangeForExpression = (
  queryModel: GrafanaExpressionModel,
  queries: GrafanaQuery[]
): RelativeTimeRange => {
  const referencedRefIds: string[] | undefined = getReferencedIds(queryModel, queries);

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

const getReferencedIds = (queryModel: GrafanaExpressionModel, queries: GrafanaQuery[]): string[] | undefined => {
  switch (queryModel.type) {
    case ExpressionQueryType.classic:
      return getReferencedIdsForClassicCondition(queryModel);
    case ExpressionQueryType.math:
      return getReferencedIdsForMath(queryModel, queries);
    case ExpressionQueryType.resample:
    case ExpressionQueryType.reduce:
      return getReferencedIdsForReduce(queryModel);
  }
};

const getReferencedIdsForClassicCondition = (queryModel: GrafanaExpressionModel) => {
  return queryModel.conditions?.map((condition) => {
    return condition.query.params[0];
  });
};

const getTimeRanges = (referencedRefIds: string[], queries: GrafanaQuery[]) => {
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

const getReferencedIdsForMath = (queryModel: GrafanaExpressionModel, queries: GrafanaQuery[]) => {
  return (
    queries
      // filter queries of type query and filter expression on if it includes any refIds
      .filter((q) => q.queryType === 'query' && queryModel.expression?.includes(q.refId))
      .map((q) => {
        return q.refId;
      })
  );
};

const getReferencedIdsForReduce = (queryModel: GrafanaExpressionModel) => {
  return queryModel.expression ? [queryModel.expression] : undefined;
};
