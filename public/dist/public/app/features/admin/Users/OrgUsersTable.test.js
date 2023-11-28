import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { getMockUsers } from '../../users/__mocks__/userMocks';
import { OrgUsersTable } from './OrgUsersTable';
jest.mock('app/core/core', () => ({
    contextSrv: {
        hasPermission: () => true,
        hasPermissionInMetadata: () => true,
        licensedAccessControlEnabled: () => false,
    },
}));
const setup = (propOverrides) => {
    const props = {
        users: [],
        onRoleChange: jest.fn(),
        onRemoveUser: jest.fn(),
        changePage: jest.fn(),
        page: 0,
        totalPages: 1,
    };
    Object.assign(props, propOverrides);
    render(React.createElement(OrgUsersTable, Object.assign({}, props)));
};
describe('Render', () => {
    it('should render component', () => {
        expect(() => setup()).not.toThrow();
    });
    it('should render users in table', () => {
        const usersData = getMockUsers(5);
        setup({ users: usersData });
        usersData.forEach((user) => {
            expect(screen.getByText(user.name)).toBeInTheDocument();
        });
    });
    it('should render disabled flag when any of the Users are disabled', () => {
        const usersData = getMockUsers(5);
        usersData[0].isDisabled = true;
        setup({ users: usersData });
        expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
    it('should render LDAP label', () => {
        const usersData = getMockUsers(5);
        usersData[0].authLabels = ['LDAP'];
        setup({ users: usersData });
        expect(screen.getByText(usersData[0].authLabels[0])).toBeInTheDocument();
    });
});
describe('Remove modal', () => {
    it('should render confirm check on delete', () => __awaiter(void 0, void 0, void 0, function* () {
        const usersData = getMockUsers(3);
        setup({ users: usersData });
        const user = userEvent.setup();
        yield user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    }));
});
//# sourceMappingURL=OrgUsersTable.test.js.map