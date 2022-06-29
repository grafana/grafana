import { isEqual } from 'lodash';
import { Store } from 'redux';

import { DataFrame, Field, FieldMatcherID, fieldMatchers, LinkModel, LoadingState, VariableModel } from '@grafana/data';
import { VariableAdapter, variableAdapters } from 'app/features/variables/adapters';
import { toKeyedAction } from 'app/features/variables/state/keyedVariablesReducer';
import {
  getLastKey,
  getNewVariableIndex,
  getVariable,
  getVariableWithName,
} from 'app/features/variables/state/selectors';
import { addVariable } from 'app/features/variables/state/sharedReducer';
import { AddVariable, VariableIdentifier } from 'app/features/variables/state/types';
import { KeyValueVariableModel, VariableHide } from 'app/features/variables/types';
import { toKeyedVariableIdentifier, toStateKey, toVariablePayload } from 'app/features/variables/utils';
import { store } from 'app/store/store';
import { StoreState } from 'app/types';

import { ConditionalDataSourceQuery } from './ConditionalDataSource';
import { queryConditionsRegistry } from './QueryConditionsRegistry';
import { ValueClickConditionOptions } from './conditions/FieldValueClickConditionEditor';
import { QueryConditionType, QueryConditionConfig } from './types';

export function getConditionalDataLinksSupplier(targets: ConditionalDataSourceQuery[]) {
  // Find targets that have field conditions
  const conditions = targets
    .map((target) =>
      target.conditions?.filter(
        (condition) => queryConditionsRegistry.getIfExists(condition.id)?.type === QueryConditionType.Field
      )
    )
    .filter((c) => c);

  return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
    let result: LinkModel[] = [];

    for (let i = 0; i < conditions.length; i++) {
      for (let j = 0; j < conditions[i]?.length; j++) {
        const regexFieldMatcher = fieldMatchers.get(FieldMatcherID.byRegexp);
        const fieldMatcher = regexFieldMatcher.get(conditions[i][j].options.pattern);

        // If clicked field matches a condition, find all other conditions that are met and populate key/value variables
        if (fieldMatcher && fieldMatcher(field, frame, allFrames)) {
          return result.concat(findRelatedDataLinks(conditions[i][j], conditions, frame, allFrames, field));
        }
      }
    }

    return result;
  };
}

export function findRelatedDataLinks(
  condition: QueryConditionConfig,
  allConditions: QueryConditionConfig[][],
  targetFrame: DataFrame,
  allFrames: DataFrame[],
  field: Field,
  // dependencies to provide mock implementation in tests
  dependencies: {
    store: Store<StoreState>;
    actions: {
      addVariable: typeof addVariable;
    };
    getVariableWithName: (name: string) => VariableModel | undefined;
    getKeyValueAdapter: () => VariableAdapter<KeyValueVariableModel>;
  } = {
    store,
    actions: { addVariable },
    getVariableWithName: (name: string) => {
      return getVariableWithName(name, store.getState());
    },
    getKeyValueAdapter: () => variableAdapters.get('keyValue'),
  }
): LinkModel[] {
  const links: LinkModel[] = [];
  // let's find all conditions that also contain provided condition
  const result = allConditions.filter((individualTargetConditions) => {
    return individualTargetConditions.some((c) => isEqual(c, condition));
  });

  // iterate throught the conditions found and figure out which conditions are met
  // 1. Given provided data
  // 2. Given dimensions applied via ket/value template variable
  for (let i = 0; i < result.length; i++) {
    let conditionsMet: boolean[] = new Array(result[i].length).fill(false);

    const fieldReferencesPerTarget: Field[] = new Array(result[i].length);

    for (let j = 0; j < result[i]?.length; j++) {
      const currentCondition = result[i][j];

      if (isEqual(currentCondition, condition)) {
        conditionsMet[j] = true;
        fieldReferencesPerTarget[j] = field;
        continue;
      }

      const regexFieldMatcher = fieldMatchers.get(FieldMatcherID.byRegexp);
      const fieldMatcher = regexFieldMatcher.get(currentCondition.options.pattern);

      targetFrame.fields.forEach((f) => {
        if (fieldMatcher(f, targetFrame, allFrames)) {
          conditionsMet[j] = true;
          fieldReferencesPerTarget[j] = f;
        }
      });
    }

    conditionsMet.map((c, idx) => {
      if (!c) {
        // Check if there is a template variable defined for a given condition already;
        const conditionDef = queryConditionsRegistry.getIfExists(result[i][idx].id);
        const expectedVariableName = conditionDef?.getVariableName(result[i][idx].options);
        const existingVariable = dependencies.getVariableWithName(expectedVariableName!);
        if (existingVariable) {
          conditionsMet[idx] = true;
        }
      }
    });

    const hasAllConditionsMet = !conditionsMet.some((m) => !m);

    if (hasAllConditionsMet) {
      links.push({
        // eslint-disable-next-line
        title: 'Drill down on ' + result[i].map((c) => (c.options as ValueClickConditionOptions).name).join(', '),
        href: '',
        onClick: async (_, origin) => {
          // Figure out variables that need to be created from scratch
          const variablesToCreate = result[i].map((c) => {
            const conditionDef = queryConditionsRegistry.getIfExists(c.id);
            const varName = conditionDef!.getVariableName(c.options);

            if (!dependencies.getVariableWithName(varName!)) {
              return varName;
            }
            // if the variable already exists, it means it was already produced by user interacting with data
            return null;
          });

          const state = dependencies.store.getState();
          const key = getLastKey(state);
          const rootStateKey = toStateKey(key);
          let createdVariablesCounter = variablesToCreate.filter((v) => v).length;

          for (let k = 0; k < variablesToCreate.length; k++) {
            const id = variablesToCreate[k];

            // ignore existing variables
            if (!id) {
              continue;
            }
            createdVariablesCounter--;

            const identifier: VariableIdentifier = { type: 'keyValue', id };
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

            dependencies.store.dispatch(
              toKeyedAction(
                rootStateKey,
                dependencies.actions.addVariable(
                  toVariablePayload<AddVariable>(identifier, { global, model: variable, index })
                )
              )
            );

            // eslint-disable-next-line
            const existing = getVariable(
              toKeyedVariableIdentifier(variable),
              dependencies.store.getState()
            ) as KeyValueVariableModel;
            const value = fieldReferencesPerTarget[k].values.get(origin.rowIndex);

            await dependencies.getKeyValueAdapter().setValue(
              existing,
              { selected: true, value, text: value ? value.toString() : '' },
              // Changes should be emited only for the last update to avoid multiple queries being executed
              createdVariablesCounter === 0
            );
          }
        },
        target: undefined,
        origin: null,
      });
    }
  }

  return links;
}
