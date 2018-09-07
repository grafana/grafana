import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { NavModelItem, StoreState, Team } from '../../../types';
import { updateNavIndex } from '../../../core/actions';
import { UpdateNavIndexAction } from '../../../core/actions/navModel';

export enum ActionTypes {
  LoadTeams = 'LOAD_TEAMS',
  LoadTeam = 'LOAD_TEAM',
  SetSearchQuery = 'SET_SEARCH_QUERY',
}

export interface LoadTeamsAction {
  type: ActionTypes.LoadTeams;
  payload: Team[];
}

export interface LoadTeamAction {
  type: ActionTypes.LoadTeam;
  payload: Team;
}

export interface SetSearchQueryAction {
  type: ActionTypes.SetSearchQuery;
  payload: string;
}

export type Action = LoadTeamsAction | SetSearchQueryAction | LoadTeamAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action | UpdateNavIndexAction>;

const teamsLoaded = (teams: Team[]): LoadTeamsAction => ({
  type: ActionTypes.LoadTeams,
  payload: teams,
});

const teamLoaded = (team: Team): LoadTeamAction => ({
  type: ActionTypes.LoadTeam,
  payload: team,
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

function buildNavModel(team: Team): NavModelItem {
  return {
    img: team.avatarUrl,
    id: 'team-' + team.id,
    subTitle: 'Manage members & settings',
    url: '',
    text: team.name,
    breadcrumbs: [{ title: 'Teams', url: 'org/teams' }],
    children: [
      {
        active: false,
        icon: 'gicon gicon-team',
        id: `team-members-${team.id}`,
        text: 'Members',
        url: `org/teams/edit/${team.id}/members`,
      },
      {
        active: false,
        icon: 'fa fa-fw fa-sliders',
        id: `team-settings-${team.id}`,
        text: 'Settings',
        url: `org/teams/edit/${team.id}/settings`,
      },
    ],
  };
}

export function loadTeam(id: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv()
      .get(`/api/teams/${id}`)
      .then(response => {
        dispatch(teamLoaded(response));
        dispatch(updateNavIndex(buildNavModel(response)));
      });
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
