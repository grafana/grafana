import { StoreState } from '../../app/types';
import { getPreloadedState } from '../../app/features/variables/state/helpers';

export const convertToStoreState = (key: string, models: any[]): StoreState => {
  const variables = models.reduce((byName, variable) => {
    byName[variable.name] = variable;
    return byName;
  }, {});
  return {
    ...getPreloadedState(key, { variables }),
  } as StoreState;
};
