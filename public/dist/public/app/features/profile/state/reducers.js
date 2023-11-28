import { __awaiter } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { isEmpty, isString, set } from 'lodash';
import { dateTimeFormatTimeAgo, setWeekStart } from '@grafana/data';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
export const initialUserState = {
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
        updateTimeZone: (state, action) => {
            state.timeZone = action.payload.timeZone;
        },
        updateWeekStart: (state, action) => {
            state.weekStart = action.payload.weekStart;
        },
        updateFiscalYearStartMonth: (state, action) => {
            state.fiscalYearStartMonth = action.payload.fiscalYearStartMonth;
        },
        setUpdating: (state, action) => {
            state.isUpdating = action.payload.updating;
        },
        userLoaded: (state, action) => {
            state.user = action.payload.user;
        },
        initLoadTeams: (state, action) => {
            state.teamsAreLoading = true;
        },
        teamsLoaded: (state, action) => {
            state.teams = action.payload.teams;
            state.teamsAreLoading = false;
        },
        initLoadOrgs: (state, action) => {
            state.orgsAreLoading = true;
        },
        orgsLoaded: (state, action) => {
            state.orgs = action.payload.orgs;
            state.orgsAreLoading = false;
        },
        initLoadSessions: (state, action) => {
            state.sessionsAreLoading = true;
        },
        sessionsLoaded: (state, action) => {
            const sorted = action.payload.sessions.sort((a, b) => Number(b.isActive) - Number(a.isActive)); // Show active sessions first
            state.sessions = sorted.map((session) => ({
                id: session.id,
                isActive: session.isActive,
                seenAt: dateTimeFormatTimeAgo(session.seenAt),
                createdAt: session.createdAt,
                clientIp: session.clientIp,
                browser: session.browser,
                browserVersion: session.browserVersion,
                os: session.os,
                osVersion: session.osVersion,
                device: session.device,
            }));
            state.sessionsAreLoading = false;
        },
        userSessionRevoked: (state, action) => {
            state.sessions = state.sessions.filter((session) => {
                return session.id !== action.payload.tokenId;
            });
            state.isUpdating = false;
        },
    },
});
export const updateFiscalYearStartMonthForSession = (fiscalYearStartMonth) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        set(contextSrv, 'user.fiscalYearStartMonth', fiscalYearStartMonth);
        dispatch(updateFiscalYearStartMonth({ fiscalYearStartMonth }));
    });
};
export const updateTimeZoneForSession = (timeZone) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        if (!isString(timeZone) || isEmpty(timeZone)) {
            timeZone = (_b = (_a = config === null || config === void 0 ? void 0 : config.bootData) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.timezone;
        }
        set(contextSrv, 'user.timezone', timeZone);
        dispatch(updateTimeZone({ timeZone }));
    });
};
export const updateWeekStartForSession = (weekStart) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        if (!isString(weekStart) || isEmpty(weekStart)) {
            weekStart = (_b = (_a = config === null || config === void 0 ? void 0 : config.bootData) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.weekStart;
        }
        set(contextSrv, 'user.weekStart', weekStart);
        dispatch(updateWeekStart({ weekStart }));
        setWeekStart(weekStart);
    });
};
export const { setUpdating, initLoadOrgs, orgsLoaded, initLoadTeams, teamsLoaded, userLoaded, userSessionRevoked, initLoadSessions, sessionsLoaded, updateTimeZone, updateWeekStart, updateFiscalYearStartMonth, } = slice.actions;
export const userReducer = slice.reducer;
export default { user: slice.reducer };
//# sourceMappingURL=reducers.js.map