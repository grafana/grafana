import { StoreState } from '../../app/types';
import { getPreloadedState } from '../../app/features/variables/state/helpers';

export const convertToStoreState = (uid: string, models: any[]): StoreState => {
  const variables = models.reduce((byName, variable) => {
    byName[variable.name] = variable;
    return byName;
  }, {});
  return {
    ...getPreloadedState(uid, { variables }),
  } as StoreState;
};
