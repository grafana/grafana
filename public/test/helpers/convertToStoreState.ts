import { StoreState } from '../../app/types';

export const convertToStoreState = (variables: any[]): StoreState => {
  return {
    templating: {
      variables: variables.reduce((byName, variable) => {
        byName[variable.name] = variable;
        return byName;
      }, {}),
    },
  } as StoreState;
};
