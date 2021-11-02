import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import config from 'app/core/config';
import { ChangePasswordPage } from './ChangePasswordPage';
import { initialUserState } from './state/reducers';
import { getNavModel } from '../../core/selectors/navModel';
import { backendSrv } from '../../core/services/backend_srv';
var defaultProps = __assign(__assign({}, initialUserState), { user: {
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
        login: 'test',
        isDisabled: false,
        isGrafanaAdmin: false,
        orgId: 0,
        authLabels: ['github'],
    }, navModel: getNavModel({
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
    }, 'profile-settings'), loadUser: jest.fn(), changePassword: jest.fn() });
function getTestContext(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var props, rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    jest.clearAllMocks();
                    jest.spyOn(backendSrv, 'get').mockResolvedValue({
                        id: 1,
                        name: 'Test User',
                        email: 'test@test.com',
                        login: 'test',
                        isDisabled: false,
                        isGrafanaAdmin: false,
                        orgId: 0,
                    });
                    props = __assign(__assign({}, defaultProps), overrides);
                    rerender = render(React.createElement(ChangePasswordPage, __assign({}, props))).rerender;
                    return [4 /*yield*/, waitFor(function () { return expect(props.loadUser).toHaveBeenCalledTimes(1); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { rerender: rerender, props: props }];
            }
        });
    });
}
describe('ChangePasswordPage', function () {
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
    it('should show change password form when user has loaded', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getTestContext()];
                case 1:
                    _a.sent();
                    expect(screen.getByText('Change Your Password')).toBeInTheDocument();
                    expect(screen.getByLabelText('Old password')).toBeInTheDocument();
                    expect(screen.getByLabelText('New password')).toBeInTheDocument();
                    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
                    expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
                    expect(screen.getByRole('link', { name: 'Cancel' })).toBeInTheDocument();
                    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/profile');
                    return [2 /*return*/];
            }
        });
    }); });
    it('should call changePassword if change password is valid', function () { return __awaiter(void 0, void 0, void 0, function () {
        var props;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getTestContext()];
                case 1:
                    props = (_a.sent()).props;
                    userEvent.type(screen.getByLabelText('Old password'), 'test');
                    userEvent.type(screen.getByLabelText('New password'), 'admin');
                    userEvent.type(screen.getByLabelText('Confirm password'), 'admin');
                    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
                    return [4 /*yield*/, waitFor(function () {
                            expect(props.changePassword).toHaveBeenCalledTimes(1);
                            expect(props.changePassword).toHaveBeenCalledWith({
                                confirmNew: 'admin',
                                newPassword: 'admin',
                                oldPassword: 'test',
                            }, expect.anything());
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should cannot change password form if ldap or authProxy enabled', function () { return __awaiter(void 0, void 0, void 0, function () {
        var rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config.ldapEnabled = true;
                    return [4 /*yield*/, getTestContext()];
                case 1:
                    rerender = (_a.sent()).rerender;
                    expect(screen.getByText('You cannot change password when LDAP or auth proxy authentication is enabled.')).toBeInTheDocument();
                    config.ldapEnabled = false;
                    config.authProxyEnabled = true;
                    rerender(React.createElement(ChangePasswordPage, __assign({}, defaultProps)));
                    expect(screen.getByText('You cannot change password when LDAP or auth proxy authentication is enabled.')).toBeInTheDocument();
                    config.authProxyEnabled = false;
                    return [2 /*return*/];
            }
        });
    }); });
    it('should show cannot change password if disableLoginForm is true and auth', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config.disableLoginForm = true;
                    return [4 /*yield*/, getTestContext()];
                case 1:
                    _a.sent();
                    expect(screen.getByText('Password cannot be changed here.')).toBeInTheDocument();
                    config.disableLoginForm = false;
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=ChangePasswordPage.test.js.map