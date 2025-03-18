import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { isEmpty, isString, set } from 'lodash';

import { dateTimeFormatTimeAgo, setWeekStart, TimeZone } from '@grafana/data';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { Team, ThunkResult, UserDTO, UserOrg, UserSession } from 'app/types';

export interface UserState {
  orgId: number;
  timeZone: TimeZone;
  weekStart: string;
  fiscalYearStartMonth: number;
  user: UserDTO | null;
  teams: Team[];
  orgs: UserOrg[];
  sessions: UserSession[];
  teamsAreLoading: boolean;
  orgsAreLoading: boolean;
  sessionsAreLoading: boolean;
  isUpdating: boolean;
}

export const initialUserState: UserState = {
  orgId: config.bootData.user.orgId,
  timeZone: config.bootData.user.timezone,
  weekStart: config.bootData.user.weekStart,
  fiscalYearStartMonth: 0,
  orgsAreLoading: false,
  sessionsAreLoading: false,
  teamsAreLoading: false,
  isUpdating: false,
  orgs: [],
  sessions: [],
  teams: [],
  user: null,
};

export const slice = createSlice({
  name: 'user/profile',
  initialState: initialUserState,
  reducers: {
    updateTimeZone: (state, action: PayloadAction<{ timeZone: TimeZone }>) => {
      state.timeZone = action.payload.timeZone;
    },
    updateWeekStart: (state, action: PayloadAction<{ weekStart: string }>) => {
      state.weekStart = action.payload.weekStart;
    },
    updateFiscalYearStartMonth: (state, action: PayloadAction<{ fiscalYearStartMonth: number }>) => {
      state.fiscalYearStartMonth = action.payload.fiscalYearStartMonth;
    },
    setUpdating: (state, action: PayloadAction<{ updating: boolean }>) => {
      state.isUpdating = action.payload.updating;
    },
    userLoaded: (state, action: PayloadAction<{ user: UserDTO }>) => {
      state.user = action.payload.user;
    },
    initLoadTeams: (state, action: PayloadAction<undefined>) => {
      state.teamsAreLoading = true;
    },
    teamsLoaded: (state, action: PayloadAction<{ teams: Team[] }>) => {
      state.teams = action.payload.teams;
      state.teamsAreLoading = false;
    },
    initLoadOrgs: (state, action: PayloadAction<undefined>) => {
      state.orgsAreLoading = true;
    },
    orgsLoaded: (state, action: PayloadAction<{ orgs: UserOrg[] }>) => {
      state.orgs = action.payload.orgs;
      state.orgsAreLoading = false;
    },
    initLoadSessions: (state, action: PayloadAction<undefined>) => {
      state.sessionsAreLoading = true;
    },
    sessionsLoaded: (state, action: PayloadAction<{ sessions: UserSession[] }>) => {
      const sorted = action.payload.sessions.sort((a, b) => Number(b.isActive) - Number(a.isActive)); // Show active sessions first
      state.sessions = sorted.map((session) => ({
        id: session.id,
        isActive: session.isActive,
        seenAt: dateTimeFormatTimeAgo(session.seenAt),
        createdAt: session.createdAt,
        clientIp: session.clientIp,
        browser: session.browser,
        browserVersion: session.browserVersion,
        authModule: session.authModule,
        os: session.os,
        osVersion: session.osVersion,
        device: session.device,
      }));
      state.sessionsAreLoading = false;
    },
    userSessionRevoked: (state, action: PayloadAction<{ tokenId: number }>) => {
      state.sessions = state.sessions.filter((session: UserSession) => {
        return session.id !== action.payload.tokenId;
      });
      state.isUpdating = false;
    },
  },
});

export const updateFiscalYearStartMonthForSession = (fiscalYearStartMonth: number): ThunkResult<void> => {
  return async (dispatch) => {
    set(contextSrv, 'user.fiscalYearStartMonth', fiscalYearStartMonth);
    dispatch(updateFiscalYearStartMonth({ fiscalYearStartMonth }));
  };
};

export const updateTimeZoneForSession = (timeZone: TimeZone): ThunkResult<void> => {
  return async (dispatch) => {
    if (!isString(timeZone) || isEmpty(timeZone)) {
      timeZone = config?.bootData?.user?.timezone;
    }

    set(contextSrv, 'user.timezone', timeZone);
    dispatch(updateTimeZone({ timeZone }));
  };
};

export const updateWeekStartForSession = (weekStart: string): ThunkResult<void> => {
  return async (dispatch) => {
    if (!isString(weekStart) || isEmpty(weekStart)) {
      weekStart = config?.bootData?.user?.weekStart;
    }

    set(contextSrv, 'user.weekStart', weekStart);
    dispatch(updateWeekStart({ weekStart }));
    setWeekStart(weekStart);
  };
};

export const {
  setUpdating,
  initLoadOrgs,
  orgsLoaded,
  initLoadTeams,
  teamsLoaded,
  userLoaded,
  userSessionRevoked,
  initLoadSessions,
  sessionsLoaded,
  updateTimeZone,
  updateWeekStart,
  updateFiscalYearStartMonth,
} = slice.actions;

export const userReducer = slice.reducer;
export default { user: slice.reducer };
