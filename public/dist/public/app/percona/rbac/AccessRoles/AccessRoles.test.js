import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import * as RolesReducer from 'app/percona/shared/core/reducers/roles/roles';
import { configureStore } from 'app/store/configureStore';
import { stubRoles, stubUsers, stubUsersMap } from '../__mocks__/stubs';
import AccessRolesPage from './AccessRoles';
jest.mock('app/features/users/state/actions', () => ({
    loadUsers: () => () => ({}),
}));
const wrapWithProvider = (children) => (React.createElement(Provider, { store: configureStore({
        users: {
            users: [
                {
                    userId: 1,
                },
            ],
        },
        percona: {
            users: {
                isLoading: false,
                users: stubUsers,
                usersMap: stubUsersMap,
            },
            roles: {
                isLoading: false,
                roles: stubRoles,
            },
        },
    }) }, children));
describe('AccessRolesPage', () => {
    it('fetches roles  on render', () => {
        const fetchRolesActionSpy = jest.spyOn(RolesReducer, 'fetchRolesAction');
        render(wrapWithProvider(React.createElement(AccessRolesPage, null)));
        expect(fetchRolesActionSpy).toHaveBeenCalled();
    });
});
//# sourceMappingURL=AccessRoles.test.js.map