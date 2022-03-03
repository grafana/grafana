import { DataFrame } from '@grafana/data';
import { SearchPageAction } from '../types';
import { FETCH_RESULTS } from './actionTypes';

export interface SearchPageState {
  dashboards?: DataFrame;
  panels?: DataFrame;
  panelTypes?: DataFrame;
  schemaVersions?: DataFrame;
}

export const searchPageState: SearchPageState = {
  dashboards: undefined,
  panels: undefined,
  panelTypes: undefined,
  schemaVersions: undefined,
};

console.log('this page ever being initialized?');
export const searchPageReducers = (state: SearchPageState, action: SearchPageAction) => {
  switch (action.type) {
    case FETCH_RESULTS:
      console.log('yo yo yo getting here????', state);
    default:
      return state;
  }
};
