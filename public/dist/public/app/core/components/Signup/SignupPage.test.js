import { __awaiter } from "tslib";
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { render } from 'test/redux-rtl';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { SignupPage } from './SignupPage';
const postMock = jest.fn();
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
        post: postMock,
    }), config: {
        loginError: false,
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
        appSubUrl: '',
        autoAssignOrg: false,
        verifyEmailEnabled: true,
    } })));
const props = Object.assign({ email: '', code: '' }, getRouteComponentProps());
describe('Signup Page', () => {
    it('renders correctly', () => {
        render(React.createElement(SignupPage, Object.assign({}, props)));
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
    it('should pass validation checks for email field', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(SignupPage, Object.assign({}, props)));
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
        expect(yield screen.findByText('Email is required')).toBeInTheDocument();
        yield userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'test');
        yield waitFor(() => expect(screen.queryByText('Email is invalid')).toBeInTheDocument());
        yield userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'test@gmail.com');
        yield waitFor(() => expect(screen.queryByText('Email is invalid')).not.toBeInTheDocument());
    }));
    it('should pass validation checks for password and confirm password field', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(SignupPage, Object.assign({}, props)));
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
        expect(yield screen.findByText('Password is required')).toBeInTheDocument();
        expect(yield screen.findByText('Confirmed password is required')).toBeInTheDocument();
        yield userEvent.type(screen.getByLabelText('Password'), 'admin');
        yield userEvent.type(screen.getByLabelText('Confirm password'), 'a');
        yield waitFor(() => expect(screen.queryByText('Passwords must match!')).toBeInTheDocument());
        yield userEvent.type(screen.getByLabelText('Confirm password'), 'dmin');
        yield waitFor(() => expect(screen.queryByText('Passwords must match!')).not.toBeInTheDocument());
    }));
    it('should navigate to default url if signup is successful', () => __awaiter(void 0, void 0, void 0, function* () {
        Object.defineProperty(window, 'location', {
            value: {
                assign: jest.fn(),
            },
        });
        postMock.mockResolvedValueOnce({ message: 'Logged in' });
        render(React.createElement(SignupPage, Object.assign({}, props)));
        yield userEvent.type(screen.getByRole('textbox', { name: 'Your name' }), 'test-user');
        yield userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'test@gmail.com');
        yield userEvent.type(screen.getByLabelText('Password'), 'admin');
        yield userEvent.type(screen.getByLabelText('Confirm password'), 'admin');
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
        yield waitFor(() => expect(postMock).toHaveBeenCalledWith('/api/user/signup/step2', {
            code: '',
            email: 'test@gmail.com',
            name: 'test-user',
            orgName: '',
            password: 'admin',
            username: 'test@gmail.com',
        }));
        expect(window.location.assign).toHaveBeenCalledWith('/');
    }));
});
//# sourceMappingURL=SignupPage.test.js.map