import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignupInvitedPage } from './SignupInvited';
import { backendSrv } from '../../core/services/backend_srv';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
jest.mock('app/core/core', function () { return ({
    contextSrv: {
        user: { orgName: 'Invited to Org Name' },
    },
}); });
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
var defaultGet = {
    email: 'some.user@localhost',
    name: 'Some User',
    invitedBy: 'Invited By User',
    username: 'someuser',
};
function setupTestContext(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.get, get = _c === void 0 ? defaultGet : _c;
    return __awaiter(this, void 0, void 0, function () {
        var getSpy, postSpy, props;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    jest.clearAllMocks();
                    getSpy = jest.spyOn(backendSrv, 'get');
                    getSpy.mockResolvedValue(get);
                    postSpy = jest.spyOn(backendSrv, 'post');
                    postSpy.mockResolvedValue([]);
                    props = __assign({}, getRouteComponentProps({
                        match: {
                            params: { code: 'some code' },
                        },
                    }));
                    render(React.createElement(SignupInvitedPage, __assign({}, props)));
                    return [4 /*yield*/, waitFor(function () { return expect(getSpy).toHaveBeenCalled(); })];
                case 1:
                    _d.sent();
                    expect(getSpy).toHaveBeenCalledTimes(1);
                    return [2 /*return*/, { getSpy: getSpy, postSpy: postSpy }];
            }
        });
    });
}
describe('SignupInvitedPage', function () {
    describe('when initialized but invite data has not been retrieved yet', function () {
        it('then it should not render', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupTestContext({ get: null })];
                    case 1:
                        _a.sent();
                        expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when initialized and invite data has been retrieved', function () {
        it('then the greeting should be correct', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupTestContext()];
                    case 1:
                        _a.sent();
                        expect(screen.getByRole('heading', {
                            name: /hello some user\./i,
                        })).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('then the invited by should be correct', function () { return __awaiter(void 0, void 0, void 0, function () {
            var view;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupTestContext()];
                    case 1:
                        _a.sent();
                        view = screen.getByText(/has invited you to join grafana and the organization please complete the following and choose a password to accept your invitation and continue:/i);
                        expect(within(view).getByText(/invited by user/i)).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('then the organization invited to should be correct', function () { return __awaiter(void 0, void 0, void 0, function () {
            var view;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupTestContext()];
                    case 1:
                        _a.sent();
                        view = screen.getByText(/has invited you to join grafana and the organization please complete the following and choose a password to accept your invitation and continue:/i);
                        expect(within(view).getByText(/invited to org name/i)).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('then the form should include form data', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupTestContext()];
                    case 1:
                        _a.sent();
                        expect(screen.getByPlaceholderText(/email@example\.com/i)).toHaveValue('some.user@localhost');
                        expect(screen.getByPlaceholderText(/name \(optional\)/i)).toHaveValue('Some User');
                        expect(screen.getByPlaceholderText(/username/i)).toHaveValue('some.user@localhost');
                        expect(screen.getByPlaceholderText(/password/i)).toHaveValue('');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when user submits the form and the required fields are not filled in', function () {
        it('then required fields should show error messages and nothing should be posted', function () { return __awaiter(void 0, void 0, void 0, function () {
            var postSpy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupTestContext({ get: { email: '', invitedBy: '', name: '', username: '' } })];
                    case 1:
                        postSpy = (_a.sent()).postSpy;
                        userEvent.click(screen.getByRole('button', { name: /sign up/i }));
                        return [4 /*yield*/, waitFor(function () { return expect(screen.getByText(/email is required/i)).toBeInTheDocument(); })];
                    case 2:
                        _a.sent();
                        expect(screen.getByText(/username is required/i)).toBeInTheDocument();
                        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
                        expect(postSpy).toHaveBeenCalledTimes(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when user submits the form and the required fields are filled in', function () {
        it('then correct form data should be posted', function () { return __awaiter(void 0, void 0, void 0, function () {
            var postSpy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupTestContext()];
                    case 1:
                        postSpy = (_a.sent()).postSpy;
                        userEvent.type(screen.getByPlaceholderText(/password/i), 'pass@word1');
                        userEvent.click(screen.getByRole('button', { name: /sign up/i }));
                        return [4 /*yield*/, waitFor(function () { return expect(postSpy).toHaveBeenCalledTimes(1); })];
                    case 2:
                        _a.sent();
                        expect(postSpy).toHaveBeenCalledWith('/api/user/invite/complete', {
                            email: 'some.user@localhost',
                            name: 'Some User',
                            username: 'some.user@localhost',
                            password: 'pass@word1',
                            inviteCode: 'some code',
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=SignupInvited.test.js.map