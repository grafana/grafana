import { TypedVariableModel } from '@grafana/data';

import { getPreloadedState } from '../../app/features/variables/state/helpers';
import { VariablesState } from '../../app/features/variables/state/types';
import { StoreState } from '../../app/types/store';

export const convertToStoreState = (key: string, models: TypedVariableModel[]): StoreState => {
  const variables = models.reduce<VariablesState>((byName, variable) => {
    byName[variable.name] = variable;
    return byName;
  }, {});
  return {
    ...getPreloadedState(key, { variables }),
  } as StoreState;
};
