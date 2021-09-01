// import { createSelector } from 'reselect';
import { pluginsAdapter } from './reducer';

// TODO<use the proper store state here>
export const selectRoot = (state: any) => state.plugins;

export const { selectAll, selectById } = pluginsAdapter.getSelectors(selectRoot);

// TODO<search by name, type, installed, etc.>
export const find = () => {};
