import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { cloneDeep as _cloneDeep } from 'lodash';

import { BMCTeamsState, BMCTeam } from 'app/types';

import { getTeamFilters } from './selectors';

export const initialState: BMCTeamsState = {
  teams: [] as BMCTeam[],
  totalCount: 0,
  selectedCount: undefined,
  page: 0,
  perPage: 30,
  isLoading: true,
  searchQuery: '',
  showSelected: false,
  teamsAdded: [],
  teamsRemoved: [],
};

export interface TeamsFetchResult {
  teams: BMCTeam[];
  perPage: number;
  page: number;
  totalCount: number;
  selectedCount: number;
}

const teamsSlice = createSlice({
  name: 'rbacTeams',
  initialState,
  reducers: {
    teamsLoaded: (state, action: PayloadAction<{ teams: TeamsFetchResult; roleId: number }>): BMCTeamsState => {
      const { perPage, page, teams, totalCount, selectedCount } = action.payload.teams;
      const teamsClone = teams?.length
        ? teams.map((team) => {
            let isChecked: boolean;
            if (state.teamsAdded.includes(team.id)) {
              isChecked = true;
            } else if (state.teamsRemoved.includes(team.id)) {
              isChecked = false;
            } else {
              isChecked = team.bhdRoleIds.includes(action.payload.roleId);
            }
            return { ...team, isChecked };
          })
        : [];

      return {
        ...state,
        isLoading: false,
        teams: teamsClone,
        perPage,
        page,
        totalCount,
        selectedCount,
      };
    },
    searchQueryChanged: (state, action: PayloadAction<string>): BMCTeamsState => {
      // reset searchPage otherwise search results won't appear
      return { ...state, searchQuery: action.payload, page: initialState.page };
    },
    teamFilterChanged: (state, action: PayloadAction<string>): BMCTeamsState => {
      // reset searchPage otherwise search results won't appear
      const showSelected = action.payload === getTeamFilters().assigned.value;
      return { ...state, showSelected: showSelected, page: initialState.page };
    },
    teamsFetchBegin: (state) => {
      return { ...state, isLoading: true };
    },
    teamsFetchEnd: (state) => {
      return { ...state, isLoading: false };
    },

    CheckStatusChanged: (state, action: PayloadAction<{ checked: boolean; teamId: number }>): BMCTeamsState => {
      const { checked, teamId } = action.payload;
      const teamsClone = _cloneDeep(state.teams);
      const added = new Set(state.teamsAdded);
      const removed = new Set(state.teamsRemoved);
      if (checked) {
        if (removed.has(teamId)) {
          removed.delete(teamId);
        } else {
          added.add(teamId);
        }
        teamsClone.find((team) => {
          if (team.id === teamId) {
            team.isChecked = true;
          }
        });
      } else {
        if (added.has(teamId)) {
          added.delete(teamId);
        } else {
          removed.add(teamId);
        }
        teamsClone.find((team) => {
          if (team.id === teamId) {
            team.isChecked = false;
          }
        });
      }

      return { ...state, teams: teamsClone, teamsAdded: [...added], teamsRemoved: [...removed] };
    },

    SelectAllStatusChanged: (state, action: PayloadAction<{ checked: boolean; roleId: number }>): BMCTeamsState => {
      const { checked, roleId } = action.payload;
      const added = new Set(state.teamsAdded);
      const removed = new Set(state.teamsRemoved);
      const teamsClone = _cloneDeep(state.teams);

      teamsClone.forEach((team) => {
        if (checked) {
          removed.delete(team.id);
          if (!team.bhdRoleIds.includes(roleId)) {
            added.add(team.id);
          }
        } else {
          added.delete(team.id);
          if (team.bhdRoleIds.includes(roleId)) {
            removed.add(team.id);
          }
        }
        team.isChecked = checked;
      });

      return { ...state, teams: teamsClone, teamsAdded: [...added], teamsRemoved: [...removed] };
    },

    ClearState: (state): BMCTeamsState => {
      return { ...state, ...initialState };
    },
  },
});

export const {
  CheckStatusChanged,
  ClearState,
  searchQueryChanged,
  SelectAllStatusChanged,
  teamFilterChanged,
  teamsLoaded,
  teamsFetchBegin,
  teamsFetchEnd,
} = teamsSlice.actions;

export const rbacTeamsReducer = teamsSlice.reducer;

export default {
  rbacTeams: rbacTeamsReducer,
};
