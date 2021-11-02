import { __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerifyEmailPage } from './VerifyEmailPage';
var postMock = jest.fn();
jest.mock('@grafana/runtime', function () { return ({
    getBackendSrv: function () { return ({
        post: postMock,
    }); },
}); });
jest.mock('app/core/config', function () {
    return {
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
        getConfig: function () { return ({
            verifyEmailEnabled: true,
            appSubUrl: '',
        }); },
    };
});
describe('VerifyEmail Page', function () {
    it('renders correctly', function () {
        render(React.createElement(VerifyEmailPage, null));
        expect(screen.getByText('Verify Email')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /Email/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Send verification email' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');
    });
    it('should pass validation checks for email field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    render(React.createElement(VerifyEmailPage, null));
                    fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }));
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('Email is required')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    userEvent.type(screen.getByRole('textbox', { name: /Email/i }), 'test');
                    return [4 /*yield*/, waitFor(function () { return expect(screen.queryByText('Email is invalid')).toBeInTheDocument(); })];
                case 2:
                    _b.sent();
                    userEvent.type(screen.getByRole('textbox', { name: /Email/i }), 'test@gmail.com');
                    return [4 /*yield*/, waitFor(function () { return expect(screen.queryByText('Email is invalid')).not.toBeInTheDocument(); })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should show complete signup if email-verification is successful', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    postMock.mockResolvedValueOnce({ message: 'SignUpCreated' });
                    render(React.createElement(VerifyEmailPage, null));
                    userEvent.type(screen.getByRole('textbox', { name: /Email/i }), 'test@gmail.com');
                    fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }));
                    return [4 /*yield*/, waitFor(function () {
                            return expect(postMock).toHaveBeenCalledWith('/api/user/signup', {
                                email: 'test@gmail.com',
                            });
                        })];
                case 1:
                    _a.sent();
                    expect(screen.getByRole('link', { name: 'Complete Signup' })).toBeInTheDocument();
                    expect(screen.getByRole('link', { name: 'Complete Signup' })).toHaveAttribute('href', '/signup');
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=VerifyEmailPage.test.js.map