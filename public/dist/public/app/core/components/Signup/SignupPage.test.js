import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { SignupPage } from './SignupPage';
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
            autoAssignOrg: false,
            verifyEmailEnabled: true,
            appSubUrl: '',
        }); },
    };
});
var props = __assign({ email: '', code: '' }, getRouteComponentProps());
describe('Signup Page', function () {
    it('renders correctly', function () {
        render(React.createElement(SignupPage, __assign({}, props)));
        expect(screen.getByRole('heading', { name: 'Welcome to Grafana' })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Your name' })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Org. name' })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /Email verification code/i })).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');
    });
    it('should pass validation checks for email field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    render(React.createElement(SignupPage, __assign({}, props)));
                    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('Email is required')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'test');
                    return [4 /*yield*/, waitFor(function () { return expect(screen.queryByText('Email is invalid')).toBeInTheDocument(); })];
                case 2:
                    _b.sent();
                    userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'test@gmail.com');
                    return [4 /*yield*/, waitFor(function () { return expect(screen.queryByText('Email is invalid')).not.toBeInTheDocument(); })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should pass validation checks for password and confirm password field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    render(React.createElement(SignupPage, __assign({}, props)));
                    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('Password is required')];
                case 1:
                    _a.apply(void 0, [_c.sent()]).toBeInTheDocument();
                    _b = expect;
                    return [4 /*yield*/, screen.findByText('Confirmed password is required')];
                case 2:
                    _b.apply(void 0, [_c.sent()]).toBeInTheDocument();
                    userEvent.type(screen.getByLabelText('Password'), 'admin');
                    userEvent.type(screen.getByLabelText('Confirm password'), 'a');
                    return [4 /*yield*/, waitFor(function () { return expect(screen.queryByText('Passwords must match!')).toBeInTheDocument(); })];
                case 3:
                    _c.sent();
                    userEvent.type(screen.getByLabelText('Confirm password'), 'dmin');
                    return [4 /*yield*/, waitFor(function () { return expect(screen.queryByText('Passwords must match!')).not.toBeInTheDocument(); })];
                case 4:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should navigate to default url if signup is successful', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    Object.defineProperty(window, 'location', {
                        value: {
                            assign: jest.fn(),
                        },
                    });
                    postMock.mockResolvedValueOnce({ message: 'Logged in' });
                    render(React.createElement(SignupPage, __assign({}, props)));
                    userEvent.type(screen.getByRole('textbox', { name: 'Your name' }), 'test-user');
                    userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'test@gmail.com');
                    userEvent.type(screen.getByLabelText('Password'), 'admin');
                    userEvent.type(screen.getByLabelText('Confirm password'), 'admin');
                    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
                    return [4 /*yield*/, waitFor(function () {
                            return expect(postMock).toHaveBeenCalledWith('/api/user/signup/step2', {
                                code: '',
                                email: 'test@gmail.com',
                                name: 'test-user',
                                orgName: '',
                                password: 'admin',
                                username: 'test@gmail.com',
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
//# sourceMappingURL=SignupPage.test.js.map