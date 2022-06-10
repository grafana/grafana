import { cloneDeep, groupBy } from 'lodash';
import { forkJoin, from, Observable, of, OperatorFunction } from 'rxjs';
import { catchError, map, mergeAll, mergeMap, reduce, toArray } from 'rxjs/operators';

import {
  ConditionID,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  LoadingState,
} from '@grafana/data';
import { getDataSourceSrv, getTemplateSrv, toDataQueryError } from '@grafana/runtime';
import { ConstantVariableModel } from 'app/features/variables/types';

export const CONDITIONAL_DATASOURCE_NAME = '-- Conditional --';

export interface BatchedQueries {
  datasource: Promise<DataSourceApi>;
  targets: DataQuery[];
}

export interface ConditionalDataSourceQuery extends DataQuery {
  conditions: Array<{
    id: ConditionID;
    options: any;
  }>;
}

export class ConditionalDataSource extends DataSourceApi<ConditionalDataSourceQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  filterQuery(query: ConditionalDataSourceQuery) {
    if (query.datasource?.uid !== CONDITIONAL_DATASOURCE_NAME) {
      const drilldownTplVars = getTemplateSrv()
        .getVariables()
        .filter((arg) => (arg as ConstantVariableModel).id.includes('field-click'));

      // Executing default (no conditions query)
      if (!query.conditions && drilldownTplVars.length === 0) {
        return true;
      }

      // Skipping default (no conditions query) if there are template variables applied
      if (!query.conditions && drilldownTplVars.length !== 0) {
        return false;
      }

      let isCorrectTarget = true;

      for (let j = 0; j < query.conditions?.length; j++) {
        if (
          drilldownTplVars.filter((arg) => {
            const result = (arg as ConstantVariableModel).name
              // TODO: refactor this fixed string
              .replace('field-click-', '')
              .match(query.conditions[j].options.field);

            return result;
          }).length === 0
        ) {
          isCorrectTarget = false;
          break;
        }
      }

      return isCorrectTarget;
    } else {
      return false;
    }
  }

  getQueryScore = (query: ConditionalDataSourceQuery) => {
    const drilldownTplVars = getTemplateSrv()
      .getVariables()
      .filter((arg) => (arg as ConstantVariableModel).id.includes('field-click'));

    if (query.conditions) {
      let score = query.conditions.length;
      for (let j = 0; j < query.conditions.length; j++) {
        const condition = query.conditions[j];
        for (let i = 0; i < drilldownTplVars.length; i++) {
          const variable = drilldownTplVars[i];
          const result = (variable as ConstantVariableModel).name
            .replace('field-click-', '')
            .match(condition.options.pattern);

          if (result) {
            score--;
          }
        }
      }

      return score;
    }

    return undefined;
  };

  query(request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    const queries = (request.targets as ConditionalDataSourceQuery[]).filter(this.filterQuery);

    let runnableQueries = [];
    const queryScores = queries.map((query) => {
      return this.getQueryScore(query);
    });

    const notScoredQueries = queryScores.filter((score) => score === undefined);

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

      runnableQueries = findQueryWithHighestNumberOfConditions(runnableQueries as ConditionalDataSourceQuery[]);
    }

    if (!runnableQueries.length) {
      return of({ data: [] } as DataQueryResponse); // nothing
    }

    // Build groups of queries to run in parallel
    const sets: { [key: string]: ConditionalDataSourceQuery[] } = groupBy(
      runnableQueries as ConditionalDataSourceQuery[],
      'datasource.uid'
    );
    const mixed: BatchedQueries[] = [];

    for (const key in sets) {
      const targets = sets[key];

      mixed.push({
        datasource: getDataSourceSrv().get(targets[0].datasource, request.scopedVars),
        targets,
      });
    }

    // Missing UIDs?
    if (!mixed.length) {
      return of({ data: [] } as DataQueryResponse); // nothing
    }

    return this.batchQueries(mixed, request);
  }

  batchQueries(mixed: BatchedQueries[], request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    const runningQueries = mixed.filter(this.isQueryable).map((query, i) =>
      from(query.datasource).pipe(
        mergeMap((api: DataSourceApi) => {
          const dsRequest = cloneDeep(request);
          dsRequest.requestId = `mixed-${i}-${dsRequest.requestId || ''}`;
          dsRequest.targets = query.targets;

          return from(api.query(dsRequest)).pipe(
            map((response) => {
              return {
                ...response,
                data: response.data || [],
                state: LoadingState.Loading,
                key: `mixed-${i}-${response.key || ''}`,
              } as DataQueryResponse;
            }),
            toArray(),
            catchError((err) => {
              err = toDataQueryError(err);
              err.message = `${api.name}: ${err.message}`;

              return of<DataQueryResponse[]>([
                {
                  data: [],
                  state: LoadingState.Error,
                  error: err,
                  key: `mixed-${i}-${dsRequest.requestId || ''}`,
                },
              ]);
            })
          );
        })
      )
    );

    return forkJoin(runningQueries).pipe(flattenResponses(), map(this.finalizeResponses), mergeAll());
  }

  testDatasource() {
    return Promise.resolve({});
  }

  private isQueryable(query: BatchedQueries): boolean {
    return query && Array.isArray(query.targets) && query.targets.length > 0;
  }

  private finalizeResponses(responses: DataQueryResponse[]): DataQueryResponse[] {
    const { length } = responses;

    if (length === 0) {
      return responses;
    }

    const error = responses.find((response) => response.state === LoadingState.Error);
    if (error) {
      responses.push(error); // adds the first found error entry so error shows up in the panel
    } else {
      responses[length - 1].state = LoadingState.Done;
    }

    return responses;
  }
}

function flattenResponses(): OperatorFunction<DataQueryResponse[][], DataQueryResponse[]> {
  return reduce((all: DataQueryResponse[], current) => {
    return current.reduce((innerAll, innerCurrent) => {
      innerAll.push.apply(innerAll, innerCurrent);
      return innerAll;
    }, all);
  }, []);
}

function findQueryWithHighestNumberOfConditions(q: ConditionalDataSourceQuery[]) {
  let maxNoConditions = 0;

  for (let i = 0; i < q.length; i++) {
    const query = q[i];
    if (query.conditions.length > maxNoConditions) {
      maxNoConditions = query.conditions.length;
    }
  }

  return q.filter((query) => query.conditions.length === maxNoConditions);
}
