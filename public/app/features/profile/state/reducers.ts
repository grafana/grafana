import { isEmpty, isString, set } from 'lodash';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { dateTimeFormat, dateTimeFormatTimeAgo, TimeZone } from '@grafana/data';

import { Team, ThunkResult, UserDTO, UserOrg, UserSession, UserState } from 'app/types';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';

export const initialUserState: UserState = {
  orgId: config.bootData.user.orgId,
  timeZone: config.bootData.user.timezone,
  loadingOrgs: false,
  loadingSessions: false,
  loadingTeams: false,
  loadingUser: false,
  updating: false,
  orgs: [],
  sessions: [],
  teams: [],
};

export const slice = createSlice({
  name: 'user/profile',
  initialState: initialUserState,
  reducers: {
    updateTimeZone: (state, action: PayloadAction<{ timeZone: TimeZone }>) => {
      state.timeZone = action.payload.timeZone;
    },
    setUpdating: (state, action: PayloadAction<{ updating: boolean }>) => {
      state.updating = action.payload.updating;
    },
    initLoadUser: (state, action: PayloadAction<undefined>) => {
      state.loadingUser = true;
    },
    userLoaded: (state, action: PayloadAction<{ user: UserDTO }>) => {
      state.user = action.payload.user;
      state.loadingUser = false;
    },
    initLoadTeams: (state, action: PayloadAction<undefined>) => {
      state.loadingTeams = true;
    },
    teamsLoaded: (state, action: PayloadAction<{ teams: Team[] }>) => {
      state.teams = action.payload.teams;
      state.loadingTeams = false;
    },
    initLoadOrgs: (state, action: PayloadAction<undefined>) => {
      state.loadingOrgs = true;
    },
    orgsLoaded: (state, action: PayloadAction<{ orgs: UserOrg[] }>) => {
      state.orgs = action.payload.orgs;
      state.loadingOrgs = false;
    },
    initLoadSessions: (state, action: PayloadAction<undefined>) => {
      state.loadingSessions = true;
    },
    sessionsLoaded: (state, action: PayloadAction<{ sessions: UserSession[] }>) => {
      const sorted = action.payload.sessions.sort((a, b) => Number(b.isActive) - Number(a.isActive)); // Show active sessions first
      state.sessions = sorted.map((session) => ({
        id: session.id,
        isActive: session.isActive,
        seenAt: dateTimeFormatTimeAgo(session.seenAt),
        createdAt: dateTimeFormat(session.createdAt, { format: 'MMMM DD, YYYY' }),
        clientIp: session.clientIp,
        browser: session.browser,
        browserVersion: session.browserVersion,
        os: session.os,
        osVersion: session.osVersion,
        device: session.device,
      }));
      state.loadingSessions = false;
    },
    userSessionRevoked: (state, action: PayloadAction<{ tokenId: number }>) => {
      state.sessions = state.sessions.filter((session: UserSession) => {
        return session.id !== action.payload.tokenId;
      });
      state.updating = false;
    },
  },
});

export const updateTimeZoneForSession = (timeZone: TimeZone): ThunkResult<void> => {
  return async (dispatch) => {
    if (!isString(timeZone) || isEmpty(timeZone)) {
      timeZone = config?.bootData?.user?.timezone;
    }

    set(contextSrv, 'user.timezone', timeZone);
    dispatch(updateTimeZone({ timeZone }));
  };
};

export const {
  setUpdating,
  initLoadOrgs,
  orgsLoaded,
  initLoadTeams,
  teamsLoaded,
  initLoadUser,
  userLoaded,
  userSessionRevoked,
  initLoadSessions,
  sessionsLoaded,
  updateTimeZone,
} = slice.actions;

export const userReducer = slice.reducer;
export default { user: slice.reducer };
