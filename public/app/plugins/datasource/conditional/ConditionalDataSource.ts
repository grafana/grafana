import { Observable } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  QueryConditionConfig,
  QueryConditionExecutionContext,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { MixedDatasource } from '../mixed/MixedDataSource';

import { queryConditionsRegistry } from './QueryConditionsRegistry';

export const CONDITIONAL_DATASOURCE_NAME = '-- Conditional --';

export interface ConditionalDataSourceQuery extends DataQuery {
  conditions: QueryConditionConfig[];
}

export class ConditionalDataSource extends MixedDatasource<ConditionalDataSourceQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  filterQueries(
    query: ConditionalDataSourceQuery,
    context: QueryConditionExecutionContext
  ): { applicable: boolean; score: number | null } {
    if (query.datasource?.uid !== CONDITIONAL_DATASOURCE_NAME) {
      if (!query.conditions) {
        return { applicable: true, score: 0 };
      }

      let queryScore = query.conditions.length;

      let isCorrectTarget = true;

      for (let j = 0; j < query.conditions?.length; j++) {
        const condition = query.conditions[j];
        const conditionDef = queryConditionsRegistry.getIfExists(condition.id);

        if (!conditionDef) {
          throw new Error(`Unknown condition type: ${condition.id}`);
        }

        if (!conditionDef.execute(condition.options, context)) {
          isCorrectTarget = false;
          break;
        } else {
          queryScore--;
        }
      }

      return { applicable: isCorrectTarget, score: queryScore };
    } else {
      return { applicable: false, score: null };
    }
  }

  getRunnableQueries(
    targets: ConditionalDataSourceQuery[],
    context: QueryConditionExecutionContext
  ): ConditionalDataSourceQuery[] {
    const queryScores: Array<number | null> = [];

    const queries = targets.filter((q) => {
      const result = this.filterQueries(q, context);
      if (result.applicable) {
        queryScores.push(result.score);
      }
      return result.applicable;
    });

    let runnableQueries = [];

    const notScoredQueries = queryScores.filter((score) => score === null);

    if (notScoredQueries.length === queryScores.length) {
      runnableQueries = queries;
    } else {
      let minScore = Infinity;

      for (let i = 0; i < queryScores.length; i++) {
        if (queryScores[i] !== undefined && queryScores[i]! <= minScore) {
          minScore = queryScores[i]!;
        }
      }

      runnableQueries = queryScores
        .map((s, i) => {
          if (s === minScore) {
            return queries[i];
          }

          return undefined;
        })
        .filter((q) => q !== undefined);

      // disabling because we know queries passed to this datasource are conditional...
      // eslint-disable-next-line
      runnableQueries = findQueryWithHighestNumberOfConditions(runnableQueries as ConditionalDataSourceQuery[]);
    }

    return runnableQueries;
  }
  query(request: DataQueryRequest<ConditionalDataSourceQuery>): Observable<DataQueryResponse> {
    const context: QueryConditionExecutionContext = {
      timeRange: request.range,
      variables: getTemplateSrv()
        .getVariables()
        .filter((v) => v.type === 'keyValue'),
    };

    // disabling because we know queries passed to this datasource are conditional...
    // eslint-disable-next-line
    const runnableQueries = this.getRunnableQueries(request.targets as ConditionalDataSourceQuery[], context);

    return super.query({ ...request, targets: runnableQueries });
  }
}

function findQueryWithHighestNumberOfConditions(q: ConditionalDataSourceQuery[]) {
  let maxNoConditions = 0;

  for (let i = 0; i < q.length; i++) {
    const query = q[i];
    if (query.conditions?.length > maxNoConditions) {
      maxNoConditions = query.conditions.length;
    }
  }

  return q.filter((query) => {
    if (!query.conditions && maxNoConditions === 0) {
      return query;
    }
    return query.conditions?.length === maxNoConditions;
  });
}
