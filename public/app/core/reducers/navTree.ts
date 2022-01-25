import { AnyAction } from '@reduxjs/toolkit';
import { NavModelItem } from '@grafana/data';

import config from 'app/core/config';

export const initialState: NavModelItem[] = config.bootData.navTree;

// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const navTreeReducer = (state: NavModelItem[] = initialState, action: AnyAction): NavModelItem[] => {
  return state;
};
