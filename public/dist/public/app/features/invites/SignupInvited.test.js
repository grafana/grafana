import { __awaiter } from "tslib";
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { backendSrv } from '../../core/services/backend_srv';
import { SignupInvitedPage } from './SignupInvited';
jest.mock('app/core/core', () => ({
    contextSrv: {
        user: { orgName: 'Invited to Org Name' },
    },
}));
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv })));
const defaultGet = {
    email: 'some.user@localhost',
    name: 'Some User',
    invitedBy: 'Invited By User',
    username: 'someuser',
};
function setupTestContext({ get = defaultGet } = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        jest.clearAllMocks();
        const getSpy = jest.spyOn(backendSrv, 'get');
        getSpy.mockResolvedValue(get);
        const postSpy = jest.spyOn(backendSrv, 'post');
        postSpy.mockResolvedValue([]);
        const props = Object.assign({}, getRouteComponentProps({
            match: {
                params: { code: 'some code' },
            },
        }));
        render(React.createElement(TestProvider, null,
            React.createElement(SignupInvitedPage, Object.assign({}, props))));
        yield waitFor(() => expect(getSpy).toHaveBeenCalled());
        expect(getSpy).toHaveBeenCalledTimes(1);
        return { getSpy, postSpy };
    });
}
describe('SignupInvitedPage', () => {
    describe('when initialized but invite data has not been retrieved yet', () => {
        it('then it should not render', () => __awaiter(void 0, void 0, void 0, function* () {
            yield setupTestContext({ get: null });
            expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
        }));
    });
    describe('when initialized and invite data has been retrieved', () => {
        it('then the greeting should be correct', () => __awaiter(void 0, void 0, void 0, function* () {
            yield setupTestContext();
            expect(screen.getByRole('heading', {
                name: /hello some user\./i,
            })).toBeInTheDocument();
        }));
        it('then the invited by should be correct', () => __awaiter(void 0, void 0, void 0, function* () {
            yield setupTestContext();
            const view = screen.getByText(/has invited you to join grafana and the organization please complete the following and choose a password to accept your invitation and continue:/i);
            expect(within(view).getByText(/invited by user/i)).toBeInTheDocument();
        }));
        it('then the organization invited to should be correct', () => __awaiter(void 0, void 0, void 0, function* () {
            yield setupTestContext();
            const view = screen.getByText(/has invited you to join grafana and the organization please complete the following and choose a password to accept your invitation and continue:/i);
            expect(within(view).getByText(/invited to org name/i)).toBeInTheDocument();
        }));
        it('then the form should include form data', () => __awaiter(void 0, void 0, void 0, function* () {
            yield setupTestContext();
            expect(screen.getByPlaceholderText(/email@example\.com/i)).toHaveValue('some.user@localhost');
            expect(screen.getByPlaceholderText(/name \(optional\)/i)).toHaveValue('Some User');
            expect(screen.getByPlaceholderText(/username/i)).toHaveValue('some.user@localhost');
            expect(screen.getByPlaceholderText(/password/i)).toHaveValue('');
        }));
    });
    describe('when user submits the form and the required fields are not filled in', () => {
        it('then required fields should show error messages and nothing should be posted', () => __awaiter(void 0, void 0, void 0, function* () {
            const { postSpy } = yield setupTestContext({ get: { email: '', invitedBy: '', name: '', username: '' } });
            yield userEvent.click(screen.getByRole('button', { name: /sign up/i }));
            yield waitFor(() => expect(screen.getByText(/email is required/i)).toBeInTheDocument());
            expect(screen.getByText(/username is required/i)).toBeInTheDocument();
            expect(screen.getByText(/password is required/i)).toBeInTheDocument();
            expect(postSpy).toHaveBeenCalledTimes(0);
        }));
    });
    describe('when user submits the form and the required fields are filled in', () => {
        it('then correct form data should be posted', () => __awaiter(void 0, void 0, void 0, function* () {
            const { postSpy } = yield setupTestContext();
            yield userEvent.type(screen.getByPlaceholderText(/password/i), 'pass@word1');
            yield userEvent.click(screen.getByRole('button', { name: /sign up/i }));
            yield waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
            expect(postSpy).toHaveBeenCalledWith('/api/user/invite/complete', {
                email: 'some.user@localhost',
                name: 'Some User',
                username: 'some.user@localhost',
                password: 'pass@word1',
                inviteCode: 'some code',
            });
        }));
    });
});
//# sourceMappingURL=SignupInvited.test.js.map