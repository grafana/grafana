import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { OrgRole, ServiceAccountStateFilter } from 'app/types';
import { ServiceAccountsListPageUnconnected } from './ServiceAccountsListPage';
jest.mock('app/core/core', () => ({
    contextSrv: {
        licensedAccessControlEnabled: () => false,
        hasPermission: () => true,
        hasPermissionInMetadata: () => true,
    },
}));
const setup = (propOverrides) => {
    const changeQueryMock = jest.fn();
    const fetchACOptionsMock = jest.fn();
    const fetchServiceAccountsMock = jest.fn();
    const deleteServiceAccountMock = jest.fn();
    const updateServiceAccountMock = jest.fn();
    const changeStateFilterMock = jest.fn();
    const createServiceAccountTokenMock = jest.fn();
    const props = {
        isLoading: false,
        page: 0,
        perPage: 10,
        query: '',
        roleOptions: [],
        serviceAccountStateFilter: ServiceAccountStateFilter.All,
        showPaging: false,
        totalPages: 1,
        serviceAccounts: [],
        changeQuery: changeQueryMock,
        fetchACOptions: fetchACOptionsMock,
        fetchServiceAccounts: fetchServiceAccountsMock,
        deleteServiceAccount: deleteServiceAccountMock,
        updateServiceAccount: updateServiceAccountMock,
        changeStateFilter: changeStateFilterMock,
        createServiceAccountToken: createServiceAccountTokenMock,
    };
    Object.assign(props, propOverrides);
    const { rerender } = render(React.createElement(TestProvider, null,
        React.createElement(ServiceAccountsListPageUnconnected, Object.assign({}, props))));
    return {
        rerender: (element) => rerender(React.createElement(TestProvider, null, element)),
        props,
        changeQueryMock,
        fetchACOptionsMock,
        fetchServiceAccountsMock,
        deleteServiceAccountMock,
        updateServiceAccountMock,
        changeStateFilterMock,
        createServiceAccountTokenMock,
    };
};
const getDefaultServiceAccount = () => ({
    id: 42,
    name: 'Data source scavenger',
    login: 'sa-data-source-scavenger',
    orgId: 1,
    role: OrgRole.Editor,
    isDisabled: false,
    teams: [],
    tokens: 1,
    createdAt: '2022-01-01 00:00:00',
});
describe('ServiceAccountsListPage tests', () => {
    it('Should display list of service accounts', () => {
        setup({
            serviceAccounts: [getDefaultServiceAccount()],
        });
        expect(screen.getByText(/Data source scavenger/)).toBeInTheDocument();
        expect(screen.getByText(/sa-data-source-scavenger/)).toBeInTheDocument();
        expect(screen.getByText(/Editor/)).toBeInTheDocument();
    });
    it('Should display enable button for disabled account', () => {
        setup({
            serviceAccounts: [
                Object.assign(Object.assign({}, getDefaultServiceAccount()), { isDisabled: true }),
            ],
        });
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
    });
    it('Should display Add token button for account without tokens', () => {
        setup({
            serviceAccounts: [
                Object.assign(Object.assign({}, getDefaultServiceAccount()), { tokens: 0 }),
            ],
        });
        expect(screen.getByRole('button', { name: 'Add token' })).toBeInTheDocument();
        expect(screen.getByText(/No tokens/)).toBeInTheDocument();
    });
    it('Should update service account role', () => __awaiter(void 0, void 0, void 0, function* () {
        const updateServiceAccountMock = jest.fn();
        setup({
            serviceAccounts: [getDefaultServiceAccount()],
            updateServiceAccount: updateServiceAccountMock,
        });
        const user = userEvent.setup();
        yield user.click(screen.getByText('Editor'));
        yield user.click(screen.getByText('Admin'));
        expect(updateServiceAccountMock).toHaveBeenCalledWith(Object.assign(Object.assign({}, getDefaultServiceAccount()), { role: OrgRole.Admin }));
    }));
    it('Should disable service account', () => __awaiter(void 0, void 0, void 0, function* () {
        const updateServiceAccountMock = jest.fn();
        setup({
            serviceAccounts: [getDefaultServiceAccount()],
            updateServiceAccount: updateServiceAccountMock,
        });
        const user = userEvent.setup();
        yield user.click(screen.getByRole('button', { name: /Disable/ }));
        yield user.click(screen.getByRole('button', { name: 'Disable service account' }));
        expect(updateServiceAccountMock).toHaveBeenCalledWith(Object.assign(Object.assign({}, getDefaultServiceAccount()), { isDisabled: true }));
    }));
    it('Should remove service account', () => __awaiter(void 0, void 0, void 0, function* () {
        const deleteServiceAccountMock = jest.fn();
        setup({
            serviceAccounts: [getDefaultServiceAccount()],
            deleteServiceAccount: deleteServiceAccountMock,
        });
        const user = userEvent.setup();
        yield user.click(screen.getByLabelText(/Delete service account/));
        yield user.click(screen.getByRole('button', { name: 'Delete' }));
        expect(deleteServiceAccountMock).toHaveBeenCalledWith(42);
    }));
});
//# sourceMappingURL=ServiceAccountsListPage.test.js.map