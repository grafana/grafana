import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { ChangePasswordPage } from './ChangePasswordPage';
const postMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
    getBackendSrv: () => ({
        post: postMock,
    }),
    config: {
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
    },
}));
const props = Object.assign({}, getRouteComponentProps({
    queryParams: { code: 'some code' },
}));
describe('ChangePassword Page', () => {
    it('renders correctly', () => {
        render(React.createElement(ChangePasswordPage, Object.assign({}, props)));
        expect(screen.getByLabelText('New password')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
    it('should pass validation checks for password and confirm password field', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ChangePasswordPage, Object.assign({}, props)));
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
        expect(yield screen.findByText('New Password is required')).toBeInTheDocument();
        expect(screen.getByText('Confirmed Password is required')).toBeInTheDocument();
        yield userEvent.type(screen.getByLabelText('New password'), 'admin');
        yield userEvent.type(screen.getByLabelText('Confirm new password'), 'a');
        yield waitFor(() => expect(screen.getByText('Passwords must match!')).toBeInTheDocument());
        yield userEvent.type(screen.getByLabelText('Confirm new password'), 'dmin');
        yield waitFor(() => expect(screen.queryByText('Passwords must match!')).not.toBeInTheDocument());
    }));
    it('should navigate to default url if change password is successful', () => __awaiter(void 0, void 0, void 0, function* () {
        Object.defineProperty(window, 'location', {
            value: {
                assign: jest.fn(),
            },
        });
        postMock.mockResolvedValueOnce({ message: 'Logged in' });
        render(React.createElement(ChangePasswordPage, Object.assign({}, props)));
        yield userEvent.type(screen.getByLabelText('New password'), 'test');
        yield userEvent.type(screen.getByLabelText('Confirm new password'), 'test');
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
        yield waitFor(() => expect(postMock).toHaveBeenCalledWith('/api/user/password/reset', {
            code: 'some code',
            confirmPassword: 'test',
            newPassword: 'test',
        }));
        expect(window.location.assign).toHaveBeenCalledWith('/');
    }));
});
//# sourceMappingURL=ChangePasswordPage.test.js.map