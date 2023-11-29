import { createAction, PayloadAction } from '@reduxjs/toolkit';
import { Reducer } from 'redux';

import { initialState, navTreeReducer } from 'app/core/reducers/navBarTree';

type NavBarTreeState = typeof initialState;

export const updateNavTree = createAction<NavBarTreeState>('updateNavTree');

/*
 * Add custom actions to grafana navtree
 */
export const navigationReducer: Reducer<NavBarTreeState> = (state, action) => {
  if (action.type === updateNavTree.type) {
    return (action as PayloadAction<NavBarTreeState>).payload;
  }
  
  return navTreeReducer(state, action);
};
