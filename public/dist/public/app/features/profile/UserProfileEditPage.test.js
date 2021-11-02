import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { within } from '@testing-library/dom';
import { OrgRole } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { UserProfileEditPage } from './UserProfileEditPage';
import { initialUserState } from './state/reducers';
import { getNavModel } from '../../core/selectors/navModel';
import { backendSrv } from '../../core/services/backend_srv';
import { TeamPermissionLevel } from '../../types';
var defaultProps = __assign(__assign({}, initialUserState), { user: {
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
        login: 'test',
        isDisabled: false,
        isGrafanaAdmin: false,
        orgId: 0,
    }, teams: [
        {
            id: 0,
            name: 'Team One',
            email: 'team.one@test.com',
            avatarUrl: '/avatar/07d881f402480a2a511a9a15b5fa82c0',
            memberCount: 2000,
            permission: TeamPermissionLevel.Admin,
        },
    ], orgs: [
        {
            name: 'Main',
            orgId: 0,
            role: OrgRole.Editor,
        },
        {
            name: 'Second',
            orgId: 1,
            role: OrgRole.Viewer,
        },
        {
            name: 'Third',
            orgId: 2,
            role: OrgRole.Admin,
        },
    ], sessions: [
        {
            id: 0,
            browser: 'Chrome',
            browserVersion: '90',
            clientIp: 'localhost',
            createdAt: '2021-01-01 04:00:00',
            device: 'Macbook Pro',
            isActive: true,
            os: 'Mac OS X',
            osVersion: '11',
            seenAt: new Date().toUTCString(),
        },
    ], navModel: getNavModel({
        'profile-settings': {
            icon: 'sliders-v-alt',
            id: 'profile-settings',
            parentItem: {
                id: 'profile',
                text: 'Test User',
                img: '/avatar/46d229b033af06a191ff2267bca9ae56',
                url: '/profile',
            },
            text: 'Preferences',
            url: '/profile',
        },
    }, 'profile-settings'), initUserProfilePage: jest.fn().mockResolvedValue(undefined), revokeUserSession: jest.fn().mockResolvedValue(undefined), changeUserOrg: jest.fn().mockResolvedValue(undefined), updateUserProfile: jest.fn().mockResolvedValue(undefined) });
function getSelectors() {
    var dashboardSelect = function () { return screen.getByLabelText(/user preferences home dashboard drop down/i); };
    var timepickerSelect = function () { return screen.getByLabelText(selectors.components.TimeZonePicker.container); };
    var teamsTable = function () { return screen.getByRole('table', { name: /user teams table/i }); };
    var orgsTable = function () { return screen.getByRole('table', { name: /user organizations table/i }); };
    var sessionsTable = function () { return screen.getByRole('table', { name: /user sessions table/i }); };
    return {
        name: function () { return screen.getByRole('textbox', { name: /^name$/i }); },
        email: function () { return screen.getByRole('textbox', { name: /email/i }); },
        username: function () { return screen.getByRole('textbox', { name: /username/i }); },
        saveProfile: function () { return screen.getByRole('button', { name: /edit user profile save button/i }); },
        dashboardSelect: dashboardSelect,
        dashboardValue: function () { return within(dashboardSelect()).getByText(/default/i); },
        timepickerSelect: timepickerSelect,
        timepickerValue: function () { return within(timepickerSelect()).getByText(/coordinated universal time/i); },
        savePreferences: function () { return screen.getByRole('button', { name: /user preferences save button/i }); },
        teamsTable: teamsTable,
        teamsRow: function () { return within(teamsTable()).getByRole('row', { name: /team one team.one@test\.com 2000/i }); },
        orgsTable: orgsTable,
        orgsEditorRow: function () { return within(orgsTable()).getByRole('row', { name: /main editor current/i }); },
        orgsViewerRow: function () { return within(orgsTable()).getByRole('row', { name: /second viewer select/i }); },
        orgsAdminRow: function () { return within(orgsTable()).getByRole('row', { name: /third admin select/i }); },
        sessionsTable: sessionsTable,
        sessionsRow: function () {
            return within(sessionsTable()).getByRole('row', {
                name: /now 2021-01-01 04:00:00 localhost chrome on mac os x 11/i,
            });
        },
    };
}
function getTestContext(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var putSpy, getSpy, searchSpy, props, rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    jest.clearAllMocks();
                    putSpy = jest.spyOn(backendSrv, 'put');
                    getSpy = jest
                        .spyOn(backendSrv, 'get')
                        .mockResolvedValue({ timezone: 'UTC', homeDashboardId: 0, theme: 'dark' });
                    searchSpy = jest.spyOn(backendSrv, 'search').mockResolvedValue([]);
                    props = __assign(__assign({}, defaultProps), overrides);
                    rerender = render(React.createElement(UserProfileEditPage, __assign({}, props))).rerender;
                    return [4 /*yield*/, waitFor(function () { return expect(props.initUserProfilePage).toHaveBeenCalledTimes(1); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { rerender: rerender, putSpy: putSpy, getSpy: getSpy, searchSpy: searchSpy, props: props }];
            }
        });
    });
}
describe('UserProfileEditPage', function () {
    describe('when loading user', function () {
        it('should show loading placeholder', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext({ user: null })];
                    case 1:
                        _a.sent();
                        expect(screen.getByText(/loading \.\.\./i)).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when user has loaded', function () {
        it('should show edit profile form', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, name, email, username, saveProfile;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, getTestContext()];
                    case 1:
                        _b.sent();
                        _a = getSelectors(), name = _a.name, email = _a.email, username = _a.username, saveProfile = _a.saveProfile;
                        expect(screen.getByText(/edit profile/i)).toBeInTheDocument();
                        expect(name()).toBeInTheDocument();
                        expect(name()).toHaveValue('Test User');
                        expect(email()).toBeInTheDocument();
                        expect(email()).toHaveValue('test@test.com');
                        expect(username()).toBeInTheDocument();
                        expect(username()).toHaveValue('test');
                        expect(saveProfile()).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should show shared preferences', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, dashboardSelect, dashboardValue, timepickerSelect, timepickerValue, savePreferences;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, getTestContext()];
                    case 1:
                        _b.sent();
                        _a = getSelectors(), dashboardSelect = _a.dashboardSelect, dashboardValue = _a.dashboardValue, timepickerSelect = _a.timepickerSelect, timepickerValue = _a.timepickerValue, savePreferences = _a.savePreferences;
                        expect(screen.getByRole('group', { name: /preferences/i })).toBeInTheDocument();
                        expect(screen.getByRole('radio', { name: /default/i })).toBeInTheDocument();
                        expect(screen.getByRole('radio', { name: /dark/i })).toBeInTheDocument();
                        expect(screen.getByRole('radio', { name: /light/i })).toBeInTheDocument();
                        expect(dashboardSelect()).toBeInTheDocument();
                        expect(dashboardValue()).toBeInTheDocument();
                        expect(timepickerSelect()).toBeInTheDocument();
                        expect(timepickerValue()).toBeInTheDocument();
                        expect(savePreferences()).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and teams are loading', function () {
            it('should show teams loading placeholder', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTestContext({ teamsAreLoading: true })];
                        case 1:
                            _a.sent();
                            expect(screen.getByText(/loading teams\.\.\./i)).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and teams are loaded', function () {
            it('should show teams', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, teamsTable, teamsRow;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, getTestContext()];
                        case 1:
                            _b.sent();
                            _a = getSelectors(), teamsTable = _a.teamsTable, teamsRow = _a.teamsRow;
                            expect(screen.getByRole('heading', { name: /teams/i })).toBeInTheDocument();
                            expect(teamsTable()).toBeInTheDocument();
                            expect(teamsRow()).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and organizations are loading', function () {
            it('should show teams loading placeholder', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTestContext({ orgsAreLoading: true })];
                        case 1:
                            _a.sent();
                            expect(screen.getByText(/loading organizations\.\.\./i)).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and organizations are loaded', function () {
            it('should show organizations', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, orgsTable, orgsEditorRow, orgsViewerRow, orgsAdminRow;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, getTestContext()];
                        case 1:
                            _b.sent();
                            _a = getSelectors(), orgsTable = _a.orgsTable, orgsEditorRow = _a.orgsEditorRow, orgsViewerRow = _a.orgsViewerRow, orgsAdminRow = _a.orgsAdminRow;
                            expect(screen.getByRole('heading', { name: /organizations/i })).toBeInTheDocument();
                            expect(orgsTable()).toBeInTheDocument();
                            expect(orgsEditorRow()).toBeInTheDocument();
                            expect(orgsViewerRow()).toBeInTheDocument();
                            expect(orgsAdminRow()).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and sessions are loading', function () {
            it('should show teams loading placeholder', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTestContext({ sessionsAreLoading: true })];
                        case 1:
                            _a.sent();
                            expect(screen.getByText(/loading sessions\.\.\./i)).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and sessions are loaded', function () {
            it('should show sessions', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, sessionsTable, sessionsRow;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, getTestContext()];
                        case 1:
                            _b.sent();
                            _a = getSelectors(), sessionsTable = _a.sessionsTable, sessionsRow = _a.sessionsRow;
                            expect(sessionsTable()).toBeInTheDocument();
                            expect(sessionsRow()).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and user is edited and saved', function () {
            it('should call updateUserProfile', function () { return __awaiter(void 0, void 0, void 0, function () {
                var props, _a, email, saveProfile;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, getTestContext()];
                        case 1:
                            props = (_b.sent()).props;
                            _a = getSelectors(), email = _a.email, saveProfile = _a.saveProfile;
                            userEvent.clear(email());
                            userEvent.type(email(), 'test@test.se');
                            // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
                            userEvent.click(saveProfile(), undefined, { skipPointerEventsCheck: true });
                            return [4 /*yield*/, waitFor(function () { return expect(props.updateUserProfile).toHaveBeenCalledTimes(1); })];
                        case 2:
                            _b.sent();
                            expect(props.updateUserProfile).toHaveBeenCalledWith({
                                email: 'test@test.se',
                                login: 'test',
                                name: 'Test User',
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and organization is changed', function () {
            it('should call changeUserOrg', function () { return __awaiter(void 0, void 0, void 0, function () {
                var props, orgsAdminSelectButton;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTestContext()];
                        case 1:
                            props = (_a.sent()).props;
                            orgsAdminSelectButton = function () {
                                return within(getSelectors().orgsAdminRow()).getByRole('button', {
                                    name: /switch to the organization named Third/i,
                                });
                            };
                            userEvent.click(orgsAdminSelectButton());
                            return [4 /*yield*/, waitFor(function () { return expect(props.changeUserOrg).toHaveBeenCalledTimes(1); })];
                        case 2:
                            _a.sent();
                            expect(props.changeUserOrg).toHaveBeenCalledWith({
                                name: 'Third',
                                orgId: 2,
                                role: 'Admin',
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and session is revoked', function () {
            it('should call revokeUserSession', function () { return __awaiter(void 0, void 0, void 0, function () {
                var props, sessionsRevokeButton;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTestContext()];
                        case 1:
                            props = (_a.sent()).props;
                            sessionsRevokeButton = function () {
                                return within(getSelectors().sessionsRow()).getByRole('button', {
                                    name: /revoke user session/i,
                                });
                            };
                            userEvent.click(sessionsRevokeButton());
                            return [4 /*yield*/, waitFor(function () { return expect(props.revokeUserSession).toHaveBeenCalledTimes(1); })];
                        case 2:
                            _a.sent();
                            expect(props.revokeUserSession).toHaveBeenCalledWith(0);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
//# sourceMappingURL=UserProfileEditPage.test.js.map