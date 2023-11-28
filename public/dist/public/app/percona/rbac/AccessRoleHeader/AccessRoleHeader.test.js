import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import * as RolesReducer from 'app/percona/shared/core/reducers/roles/roles';
import * as UsersReducer from 'app/percona/shared/core/reducers/users/users';
import { configureStore } from 'app/store/configureStore';
import { stubRoles, stubUsers, stubUsersMap } from '../__mocks__/stubs';
import AccessRoleHeader from './AccessRoleHeader';
const wrapWithProvider = (children, enableAccessControl = true) => (React.createElement(Provider, { store: configureStore({
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
    }) },
    React.createElement("table", null,
        React.createElement("thead", null,
            React.createElement("tr", null, children)))));
describe('AccessRoleHeader', () => {
    it('renders correctly', () => {
        render(wrapWithProvider(React.createElement(AccessRoleHeader, null)));
        expect(screen.getByTestId('access-role-header')).toHaveTextContent('Access Role');
    });
    it('fetches roles and users on render', () => {
        const fetchRolesActionSpy = jest.spyOn(RolesReducer, 'fetchRolesAction');
        const fetchUsersListActionSpy = jest.spyOn(UsersReducer, 'fetchUsersListAction');
        render(wrapWithProvider(React.createElement(AccessRoleHeader, null)));
        expect(fetchRolesActionSpy).toHaveBeenCalled();
        expect(fetchUsersListActionSpy).toHaveBeenCalled();
    });
});
//# sourceMappingURL=AccessRoleHeader.test.js.map