import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { StoreState, Team } from '../../../types';

export enum ActionTypes {
  LoadTeams = 'LOAD_TEAMS',
  SetSearchQuery = 'SET_SEARCH_QUERY',
}

export interface LoadTeamsAction {
  type: ActionTypes.LoadTeams;
  payload: Team[];
}

export interface SetSearchQueryAction {
  type: ActionTypes.SetSearchQuery;
  payload: string;
}

export type Action = LoadTeamsAction | SetSearchQueryAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

const teamsLoaded = (teams: Team[]): LoadTeamsAction => ({
  type: ActionTypes.LoadTeams,
  payload: teams,
});

export const setSearchQuery = (searchQuery: string): SetSearchQueryAction => ({
  type: ActionTypes.SetSearchQuery,
  payload: searchQuery,
});

export function loadTeams(): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get('/api/teams/search', { perpage: 1000, page: 1 });
    dispatch(teamsLoaded(response.teams));
  };
}

export function deleteTeam(id: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv()
      .delete(`/api/teams/${id}`)
      .then(() => {
        dispatch(loadTeams());
      });
  };
}
