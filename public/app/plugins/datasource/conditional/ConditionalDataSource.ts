import { Observable } from 'rxjs';

import {
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  Field,
  FieldMatcherID,
  fieldMatchers,
  LoadingState,
  QueryConditionConfig,
  QueryConditionExecutionContext,
  QueryConditionType,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { VariableAdapter, variableAdapters } from 'app/features/variables/adapters';
import { toKeyedAction } from 'app/features/variables/state/keyedVariablesReducer';
import { getLastKey, getNewVariableIndex, getVariable } from 'app/features/variables/state/selectors';
import { addVariable } from 'app/features/variables/state/sharedReducer';
import { AddVariable, VariableIdentifier } from 'app/features/variables/state/types';
import { KeyValueVariableModel, VariableHide } from 'app/features/variables/types';
import { toKeyedVariableIdentifier, toStateKey, toVariablePayload } from 'app/features/variables/utils';
import { store } from 'app/store/store';

import { MixedDatasource } from '../mixed/MixedDataSource';

import { conditionsRegistry } from './ConditionsRegistry';

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
        const conditionDef = conditionsRegistry.getIfExists(condition.id);

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

  query(request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    const queryScores: Array<number | null> = [];

    const context = {
      timeRange: request.range,
      variables: getTemplateSrv().getVariables(),
    };

    const queries = (request.targets as ConditionalDataSourceQuery[]).filter((q) => {
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

      runnableQueries = findQueryWithHighestNumberOfConditions(runnableQueries as ConditionalDataSourceQuery[]);
    }

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

export function getConditionalDataLinksSupplier(targets: ConditionalDataSourceQuery[]) {
  const conditions = targets.map((target) =>
    target.conditions?.filter(
      (condition) => conditionsRegistry.getIfExists(condition.id)?.type === QueryConditionType.Field
    )
  );

  return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
    for (let i = 0; i < conditions.length; i++) {
      for (let j = 0; j < conditions[i]?.length; j++) {
        const conditionDef = conditionsRegistry.getIfExists(conditions[i][j].id);
        const regexFieldMatcher = fieldMatchers.get(FieldMatcherID.byRegexp);
        const fieldMatcher = regexFieldMatcher.get(conditions[i][j].options.pattern);

        if (fieldMatcher && fieldMatcher(field, frame, allFrames)) {
          return async (evt: any, origin: any) => {
            const state = store.getState();

            const key = getLastKey(state);

            const rootStateKey = toStateKey(key);
            const id = conditionDef!.getVariableName(conditions[i][j].options);
            const identifier: VariableIdentifier = { type: 'constant', id };
            const global = false;
            const index = getNewVariableIndex(rootStateKey, state);

            const variable: KeyValueVariableModel = {
              id,
              rootStateKey,
              index,
              type: 'keyValue',
              skipUrlSync: false,
              global: true,
              hide: VariableHide.dontHide,
              key: id,
              error: null,
              state: LoadingState.Done,
              description: '',
              name: id,
              query: '',
              options: [{ selected: true, value: '', text: '' }],
              current: { selected: true, value: '', text: '' },
            };

            store.dispatch(
              toKeyedAction(
                rootStateKey,
                addVariable(toVariablePayload<AddVariable>(identifier, { global, model: variable, index }))
              )
            );

            const existing = getVariable(
              toKeyedVariableIdentifier(variable),
              store.getState()
            ) as KeyValueVariableModel;
            const value = origin.field.values.get(origin.rowIndex);
            const adapter = variableAdapters.get('keyValue') as VariableAdapter<KeyValueVariableModel>;
            await adapter.setValue(existing, { selected: true, value, text: value ? value.toString() : '' }, true);
          };
        }
      }
    }

    return undefined;
  };
}
