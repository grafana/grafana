var _a;
import { __awaiter, __generator } from "tslib";
import { isEmpty, isString, set } from 'lodash';
import { createSlice } from '@reduxjs/toolkit';
import { dateTimeFormat, dateTimeFormatTimeAgo, setWeekStart } from '@grafana/data';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
export var initialUserState = {
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
export var slice = createSlice({
    name: 'user/profile',
    initialState: initialUserState,
    reducers: {
        updateTimeZone: function (state, action) {
            state.timeZone = action.payload.timeZone;
        },
        updateWeekStart: function (state, action) {
            state.weekStart = action.payload.weekStart;
        },
        updateFiscalYearStartMonth: function (state, action) {
            state.fiscalYearStartMonth = action.payload.fiscalYearStartMonth;
        },
        setUpdating: function (state, action) {
            state.isUpdating = action.payload.updating;
        },
        userLoaded: function (state, action) {
            state.user = action.payload.user;
        },
        initLoadTeams: function (state, action) {
            state.teamsAreLoading = true;
        },
        teamsLoaded: function (state, action) {
            state.teams = action.payload.teams;
            state.teamsAreLoading = false;
        },
        initLoadOrgs: function (state, action) {
            state.orgsAreLoading = true;
        },
        orgsLoaded: function (state, action) {
            state.orgs = action.payload.orgs;
            state.orgsAreLoading = false;
        },
        initLoadSessions: function (state, action) {
            state.sessionsAreLoading = true;
        },
        sessionsLoaded: function (state, action) {
            var sorted = action.payload.sessions.sort(function (a, b) { return Number(b.isActive) - Number(a.isActive); }); // Show active sessions first
            state.sessions = sorted.map(function (session) { return ({
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
            }); });
            state.sessionsAreLoading = false;
        },
        userSessionRevoked: function (state, action) {
            state.sessions = state.sessions.filter(function (session) {
                return session.id !== action.payload.tokenId;
            });
            state.isUpdating = false;
        },
    },
});
export var updateFiscalYearStartMonthForSession = function (fiscalYearStartMonth) {
    return function (dispatch) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            set(contextSrv, 'user.fiscalYearStartMonth', fiscalYearStartMonth);
            dispatch(updateFiscalYearStartMonth({ fiscalYearStartMonth: fiscalYearStartMonth }));
            return [2 /*return*/];
        });
    }); };
};
export var updateTimeZoneForSession = function (timeZone) {
    return function (dispatch) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            if (!isString(timeZone) || isEmpty(timeZone)) {
                timeZone = (_b = (_a = config === null || config === void 0 ? void 0 : config.bootData) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.timezone;
            }
            set(contextSrv, 'user.timezone', timeZone);
            dispatch(updateTimeZone({ timeZone: timeZone }));
            return [2 /*return*/];
        });
    }); };
};
export var updateWeekStartForSession = function (weekStart) {
    return function (dispatch) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            if (!isString(weekStart) || isEmpty(weekStart)) {
                weekStart = (_b = (_a = config === null || config === void 0 ? void 0 : config.bootData) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.weekStart;
            }
            set(contextSrv, 'user.weekStart', weekStart);
            dispatch(updateWeekStart({ weekStart: weekStart }));
            setWeekStart(weekStart);
            return [2 /*return*/];
        });
    }); };
};
export var setUpdating = (_a = slice.actions, _a.setUpdating), initLoadOrgs = _a.initLoadOrgs, orgsLoaded = _a.orgsLoaded, initLoadTeams = _a.initLoadTeams, teamsLoaded = _a.teamsLoaded, userLoaded = _a.userLoaded, userSessionRevoked = _a.userSessionRevoked, initLoadSessions = _a.initLoadSessions, sessionsLoaded = _a.sessionsLoaded, updateTimeZone = _a.updateTimeZone, updateWeekStart = _a.updateWeekStart, updateFiscalYearStartMonth = _a.updateFiscalYearStartMonth;
export var userReducer = slice.reducer;
export default { user: slice.reducer };
//# sourceMappingURL=reducers.js.map