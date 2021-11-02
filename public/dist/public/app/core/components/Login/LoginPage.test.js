import { __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
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
        getConfig: function () { return ({
            appSubUrl: '',
            verifyEmailEnabled: false,
        }); },
    };
});
describe('Login Page', function () {
    it('renders correctly', function () {
        render(React.createElement(LoginPage, null));
        expect(screen.getByRole('heading', { name: 'Welcome to Grafana' })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Username input field' })).toBeInTheDocument();
        expect(screen.getByLabelText('Password input field')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Login button' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Forgot your password?' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/user/password/send-reset-email');
        expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
    });
    it('should pass validation checks for username field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    render(React.createElement(LoginPage, null));
                    fireEvent.click(screen.getByRole('button', { name: 'Login button' }));
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('Email or username is required')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    userEvent.type(screen.getByRole('textbox', { name: 'Username input field' }), 'admin');
                    return [4 /*yield*/, waitFor(function () { return expect(screen.queryByText('Email or username is required')).not.toBeInTheDocument(); })];
                case 2:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should pass validation checks for password field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    render(React.createElement(LoginPage, null));
                    fireEvent.click(screen.getByRole('button', { name: 'Login button' }));
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('Password is required')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    userEvent.type(screen.getByLabelText('Password input field'), 'admin');
                    return [4 /*yield*/, waitFor(function () { return expect(screen.queryByText('Password is required')).not.toBeInTheDocument(); })];
                case 2:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should navigate to default url if credentials is valid', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    Object.defineProperty(window, 'location', {
                        value: {
                            assign: jest.fn(),
                        },
                    });
                    postMock.mockResolvedValueOnce({ message: 'Logged in' });
                    render(React.createElement(LoginPage, null));
                    userEvent.type(screen.getByLabelText('Username input field'), 'admin');
                    userEvent.type(screen.getByLabelText('Password input field'), 'test');
                    fireEvent.click(screen.getByLabelText('Login button'));
                    return [4 /*yield*/, waitFor(function () { return expect(postMock).toHaveBeenCalledWith('/login', { password: 'test', user: 'admin' }); })];
                case 1:
                    _a.sent();
                    expect(window.location.assign).toHaveBeenCalledWith('/');
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=LoginPage.test.js.map