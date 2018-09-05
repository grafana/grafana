import { TeamsState } from '../../../types';
import { Action } from './actions';

const initialState: TeamsState = { teams: [] };

export const teamsReducer = (state = initialState, action: Action): TeamsState => {
  switch (action.type) {
  }
  return state;
};

export default {
  teams: teamsReducer,
};
