import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import * as RolesReducer from 'app/percona/shared/core/reducers/roles/roles';
import { UserService } from 'app/percona/shared/services/user/__mocks__/User.service';
import { configureStore } from 'app/store/configureStore';
import { stubRoles, stubUsers, stubUsersMap } from '../../../__mocks__/stubs';
import DeleteRoleModal from './DeleteRoleModal';
jest.mock('app/percona/shared/services/roles/Roles.service');
jest.mock('app/percona/shared/services/user/User.service', () => (Object.assign(Object.assign({}, UserService), { getUsersList: () => Promise.resolve({
        users: [
            {
                role_ids: stubUsers[0].roleIds,
                user_id: stubUsers[0].userId,
            },
        ],
    }) })));
const cancelFn = jest.fn();
const wrapWithProvider = (children) => (React.createElement(Provider, { store: configureStore({
        users: {
            users: [
                {
                    userId: stubUsers[0].userId,
                },
            ],
        },
        percona: {
            users: {
                isLoading: false,
                users: [stubUsers[0]],
                usersMap: stubUsersMap,
            },
            roles: {
                isLoading: false,
                roles: stubRoles,
            },
        },
    }) }, children));
const renderDefault = (isOpen = true, role = stubRoles[0]) => render(wrapWithProvider(React.createElement(DeleteRoleModal, { role: role, isOpen: isOpen, onCancel: cancelFn })));
describe('DeleteRoleModal', () => {
    beforeEach(() => {
        cancelFn.mockClear();
    });
    it("doesn't render when it's closed", () => {
        renderDefault(false);
        expect(screen.queryByText('Delete "Role #1" role')).toBeNull();
    });
    it("renders when it's open", () => {
        renderDefault();
        expect(screen.queryByText('Delete "Role #1" role')).not.toBeNull();
    });
    it('calls delete', () => __awaiter(void 0, void 0, void 0, function* () {
        const deleteRoleActionSpy = jest.spyOn(RolesReducer, 'deleteRoleAction');
        renderDefault(true, stubRoles[1]);
        yield waitFor(() => expect(screen.queryByText('Confirm and delete role')).toBeInTheDocument());
        const deleteButton = screen.getByText('Confirm and delete role');
        fireEvent.click(deleteButton);
        yield waitFor(() => expect(deleteRoleActionSpy).toHaveBeenCalled());
    }));
    it('shows role replacement selection when users are assigned', () => __awaiter(void 0, void 0, void 0, function* () {
        renderDefault(true, stubRoles[0]);
        yield waitFor(() => expect(screen.queryByText('Confirm and delete role')).toBeInTheDocument());
        yield waitFor(() => expect(screen.queryByLabelText('Replacement role')).toBeInTheDocument());
    }));
    it('doesnt show  role replacement selection when no users are assigned', () => __awaiter(void 0, void 0, void 0, function* () {
        renderDefault(true, stubRoles[1]);
        yield waitFor(() => expect(screen.queryByText('Confirm and delete role')).toBeInTheDocument());
        yield waitFor(() => expect(screen.queryByLabelText('Replacement role')).toBeNull());
    }));
});
//# sourceMappingURL=DeleteRoleModal.test.js.map