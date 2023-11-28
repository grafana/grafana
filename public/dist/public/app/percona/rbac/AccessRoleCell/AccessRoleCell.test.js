import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import selectEvent from 'react-select-event';
import * as RolesReducer from 'app/percona/shared/core/reducers/roles/roles';
import { configureStore } from 'app/store/configureStore';
import AccessRolesEnabledCheck from '../AccessRolesEnabledCheck/AccessRolesEnabledCheck';
import { stubRoles, stubUsers, stubUserSingleRole, stubUsersMap, subUserMultipleRoles } from '../__mocks__/stubs';
import AccessRoleCell from './AccessRoleCell';
const wrapWithTable = (element) => (React.createElement("table", null,
    React.createElement("tbody", null,
        React.createElement("tr", null,
            React.createElement(AccessRolesEnabledCheck, null, element)))));
const wrapWithProvider = (element, enableAccessControl = true) => (React.createElement(Provider, { store: configureStore({
        percona: {
            settings: {
                result: {
                    enableAccessControl,
                },
            },
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
    }) }, wrapWithTable(element)));
describe('AccessRoleCell', () => {
    it('shows cell when access roles are enabled', () => {
        render(wrapWithProvider(React.createElement(AccessRoleCell, { user: stubUserSingleRole })));
        const select = screen.queryByLabelText('Access Roles');
        expect(select).toBeInTheDocument();
    });
    it("isn't shown when access roles are disabled", () => {
        render(wrapWithProvider(React.createElement(AccessRoleCell, { user: stubUserSingleRole }), false));
        const select = screen.queryByLabelText('Access Roles');
        expect(select).not.toBeInTheDocument();
    });
    it('shows the current users role', () => {
        render(wrapWithProvider(React.createElement(AccessRoleCell, { user: stubUserSingleRole })));
        const option = screen.queryByText(stubRoles[0].title);
        expect(option).toBeInTheDocument();
    });
    it('shows the current users roles', () => {
        render(wrapWithProvider(React.createElement(AccessRoleCell, { user: subUserMultipleRoles })));
        const option1 = screen.queryByText(stubRoles[0].title);
        const option2 = screen.queryByText(stubRoles[1].title);
        expect(option1).toBeInTheDocument();
        expect(option2).toBeInTheDocument();
    });
    it('calls api when role has been selected', () => __awaiter(void 0, void 0, void 0, function* () {
        const assignRoleActionSpy = jest.spyOn(RolesReducer, 'assignRoleAction');
        render(wrapWithProvider(React.createElement(AccessRoleCell, { user: stubUserSingleRole })));
        const roleSelect = screen.getByLabelText('Access Roles');
        yield selectEvent.select(roleSelect, ['Role #1', 'Role #2'], { container: document.body });
        expect(assignRoleActionSpy).toHaveBeenCalledWith({
            userId: 2,
            roleIds: [1, 2],
        });
    }));
    it('calls api when role has been removed', () => __awaiter(void 0, void 0, void 0, function* () {
        const assignRoleActionSpy = jest.spyOn(RolesReducer, 'assignRoleAction');
        render(wrapWithProvider(React.createElement(AccessRoleCell, { user: subUserMultipleRoles })));
        const removeButton = screen.getByLabelText('Remove Role #1');
        removeButton.click();
        expect(assignRoleActionSpy).toHaveBeenCalledWith({
            userId: 3,
            roleIds: [2],
        });
    }));
});
//# sourceMappingURL=AccessRoleCell.test.js.map