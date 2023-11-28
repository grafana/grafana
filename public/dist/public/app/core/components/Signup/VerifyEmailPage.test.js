import { __awaiter } from "tslib";
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { render } from 'test/redux-rtl';
import { VerifyEmailPage } from './VerifyEmailPage';
const postMock = jest.fn();
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
        post: postMock,
    }), config: {
        buildInfo: {
            version: 'v1.0',
            commit: '1',
            env: 'production',
            edition: 'Open Source',
        },
        licenseInfo: {
            stateInfo: '',
            licenseUrl: '',
        },
        verifyEmailEnabled: true,
        appSubUrl: '',
    } })));
describe('VerifyEmail Page', () => {
    it('renders correctly', () => {
        render(React.createElement(VerifyEmailPage, null));
        expect(screen.getByText('Verify Email')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /Email/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Send verification email' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');
    });
    it('should pass validation checks for email field', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(VerifyEmailPage, null));
        fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }));
        expect(yield screen.findByText('Email is required')).toBeInTheDocument();
        yield userEvent.type(screen.getByRole('textbox', { name: /Email/i }), 'test');
        yield waitFor(() => expect(screen.queryByText('Email is invalid')).toBeInTheDocument());
        yield userEvent.type(screen.getByRole('textbox', { name: /Email/i }), 'test@gmail.com');
        yield waitFor(() => expect(screen.queryByText('Email is invalid')).not.toBeInTheDocument());
    }));
    it('should show complete signup if email-verification is successful', () => __awaiter(void 0, void 0, void 0, function* () {
        postMock.mockResolvedValueOnce({ message: 'SignUpCreated' });
        render(React.createElement(VerifyEmailPage, null));
        yield userEvent.type(screen.getByRole('textbox', { name: /Email/i }), 'test@gmail.com');
        fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }));
        yield waitFor(() => expect(postMock).toHaveBeenCalledWith('/api/user/signup', {
            email: 'test@gmail.com',
        }));
        expect(screen.getByRole('link', { name: 'Complete Signup' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Complete Signup' })).toHaveAttribute('href', '/signup');
    }));
});
//# sourceMappingURL=VerifyEmailPage.test.js.map