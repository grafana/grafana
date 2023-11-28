import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import config from 'app/core/config';
import { backendSrv } from '../../core/services/backend_srv';
import { ChangePasswordPage } from './ChangePasswordPage';
import { initialUserState } from './state/reducers';
const defaultProps = Object.assign(Object.assign({}, initialUserState), { user: {
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
        login: 'test',
        isDisabled: false,
        isGrafanaAdmin: false,
        orgId: 0,
        authLabels: ['github'],
    }, loadUser: jest.fn(), changePassword: jest.fn() });
function getTestContext(overrides = {}) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const props = Object.assign(Object.assign({}, defaultProps), overrides);
        const { rerender } = render(React.createElement(TestProvider, null,
            React.createElement(ChangePasswordPage, Object.assign({}, props))));
        yield waitFor(() => expect(props.loadUser).toHaveBeenCalledTimes(1));
        return { rerender, props };
    });
}
describe('ChangePasswordPage', () => {
    it('should show loading placeholder', () => __awaiter(void 0, void 0, void 0, function* () {
        yield getTestContext({ user: null });
        expect(screen.getByText(/loading \.\.\./i)).toBeInTheDocument();
    }));
    it('should show change password form when user has loaded', () => __awaiter(void 0, void 0, void 0, function* () {
        yield getTestContext();
        expect(screen.getByLabelText('Old password')).toBeInTheDocument();
        expect(screen.getByLabelText('New password')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/profile');
    }));
    it('should call changePassword if change password is valid', () => __awaiter(void 0, void 0, void 0, function* () {
        const { props } = yield getTestContext();
        yield userEvent.type(screen.getByLabelText('Old password'), 'test');
        yield userEvent.type(screen.getByLabelText('New password'), 'admin');
        yield userEvent.type(screen.getByLabelText('Confirm password'), 'admin');
        fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
        yield waitFor(() => {
            expect(props.changePassword).toHaveBeenCalledTimes(1);
            expect(props.changePassword).toHaveBeenCalledWith({
                confirmNew: 'admin',
                newPassword: 'admin',
                oldPassword: 'test',
            }, expect.anything());
        });
    }));
    it('should cannot change password form if user signed in with LDAP', () => __awaiter(void 0, void 0, void 0, function* () {
        yield getTestContext({
            user: Object.assign(Object.assign({}, defaultProps.user), { authLabels: ['LDAP'] }),
        });
        expect(screen.getByText('You cannot change password when signed in with LDAP or auth proxy.')).toBeInTheDocument();
    }));
    it('should cannot change password form if user signed in with auth proxy', () => __awaiter(void 0, void 0, void 0, function* () {
        yield getTestContext({
            user: Object.assign(Object.assign({}, defaultProps.user), { authLabels: ['Auth Proxy'] }),
        });
        expect(screen.getByText('You cannot change password when signed in with LDAP or auth proxy.')).toBeInTheDocument();
    }));
    it('should show cannot change password if disableLoginForm is true and auth', () => __awaiter(void 0, void 0, void 0, function* () {
        config.disableLoginForm = true;
        yield getTestContext();
        expect(screen.getByText('Password cannot be changed here.')).toBeInTheDocument();
        config.disableLoginForm = false;
    }));
});
//# sourceMappingURL=ChangePasswordPage.test.js.map