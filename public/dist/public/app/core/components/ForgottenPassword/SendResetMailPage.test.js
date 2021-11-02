import { __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SendResetMailPage } from './SendResetMailPage';
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
        appSubUrl: '',
    };
});
describe('VerifyEmail Page', function () {
    it('renders correctly', function () {
        render(React.createElement(SendResetMailPage, null));
        expect(screen.getByText('Reset password')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /User Enter your information/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Send reset email' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');
    });
    it('should pass validation checks for email field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    render(React.createElement(SendResetMailPage, null));
                    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('Email or username is required')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    userEvent.type(screen.getByRole('textbox', { name: /User Enter your information/i }), 'test@gmail.com');
                    return [4 /*yield*/, waitFor(function () { return expect(screen.queryByText('Email is invalid')).not.toBeInTheDocument(); })];
                case 2:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should show success meessage if reset-password is successful', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    postMock.mockResolvedValueOnce({ message: 'Email sent' });
                    render(React.createElement(SendResetMailPage, null));
                    userEvent.type(screen.getByRole('textbox', { name: /User Enter your information/i }), 'test@gmail.com');
                    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
                    return [4 /*yield*/, waitFor(function () {
                            return expect(postMock).toHaveBeenCalledWith('/api/user/password/send-reset-email', {
                                userOrEmail: 'test@gmail.com',
                            });
                        })];
                case 1:
                    _a.sent();
                    expect(screen.getByText(/An email with a reset link/i)).toBeInTheDocument();
                    expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument();
                    expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=SendResetMailPage.test.js.map