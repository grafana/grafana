import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { ChangePasswordPage } from './ChangePasswordPage';
var postMock = jest.fn();
jest.mock('@grafana/runtime', function () { return ({
    getBackendSrv: function () { return ({
        post: postMock,
    }); },
}); });
jest.mock('app/core/config', function () {
    return {
        loginError: false,
        buildInfo: {
            version: 'v1.0',
            commit: '1',
            env: 'production',
            edition: 'Open Source',
            isEnterprise: false,
        },
        licenseInfo: {
            stateInfo: '',
            licenseUrl: '',
        },
        appSubUrl: '',
    };
});
var props = __assign({}, getRouteComponentProps({
    queryParams: { code: 'some code' },
}));
describe('ChangePassword Page', function () {
    it('renders correctly', function () {
        render(React.createElement(ChangePasswordPage, __assign({}, props)));
        expect(screen.getByLabelText('New password')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
    it('should pass validation checks for password and confirm password field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    render(React.createElement(ChangePasswordPage, __assign({}, props)));
                    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('New Password is required')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    expect(screen.getByText('Confirmed Password is required')).toBeInTheDocument();
                    userEvent.type(screen.getByLabelText('New password'), 'admin');
                    userEvent.type(screen.getByLabelText('Confirm new password'), 'a');
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByText('Passwords must match!')).toBeInTheDocument(); })];
                case 2:
                    _b.sent();
                    userEvent.type(screen.getByLabelText('Confirm new password'), 'dmin');
                    return [4 /*yield*/, waitFor(function () { return expect(screen.queryByText('Passwords must match!')).not.toBeInTheDocument(); })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should navigate to default url if change password is successful', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    Object.defineProperty(window, 'location', {
                        value: {
                            assign: jest.fn(),
                        },
                    });
                    postMock.mockResolvedValueOnce({ message: 'Logged in' });
                    render(React.createElement(ChangePasswordPage, __assign({}, props)));
                    userEvent.type(screen.getByLabelText('New password'), 'test');
                    userEvent.type(screen.getByLabelText('Confirm new password'), 'test');
                    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
                    return [4 /*yield*/, waitFor(function () {
                            return expect(postMock).toHaveBeenCalledWith('/api/user/password/reset', {
                                code: 'some code',
                                confirmPassword: 'test',
                                newPassword: 'test',
                            });
                        })];
                case 1:
                    _a.sent();
                    expect(window.location.assign).toHaveBeenCalledWith('/');
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=ChangePasswordPage.test.js.map