import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { stubRoles, stubUsers, stubUsersMap } from 'app/percona/rbac/__mocks__/stubs';
import { configureStore } from 'app/store/configureStore';
import AddEditRoleForm from './AddEditRoleForm';
jest.mock('@grafana/runtime', () => {
    const runtime = jest.requireActual('@grafana/runtime');
    return Object.assign(Object.assign({}, runtime), { getDataSourceSrv: () => ({
            getInstanceSettings: () => undefined,
        }) });
});
const wrapWithProvider = (children, options) => (React.createElement(Provider, { store: configureStore({
        percona: {
            user: {
                isAuthorized: options.isAuthorized,
            },
            settings: {
                result: {
                    enableAccessControl: options.enableAccessControl,
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
    }) }, children));
const onCancelFc = jest.fn();
const onSubmitFc = jest.fn();
const initialValues = {
    filter: '',
    title: '',
    description: '',
};
const renderWithDefaults = (options, props) => render(wrapWithProvider(React.createElement(AddEditRoleForm, Object.assign({ onCancel: onCancelFc, cancelLabel: "Cancel", onSubmit: onSubmitFc, submitLabel: "Submit", title: "Title", initialValues: initialValues }, props)), Object.assign({ enableAccessControl: true, isAuthorized: true }, options)));
describe('AddEditRoleForm', () => {
    beforeEach(() => {
        onCancelFc.mockClear();
        onSubmitFc.mockClear();
    });
    it("shows warning if user isn't an admin", () => {
        renderWithDefaults({ isAuthorized: false });
        expect(screen.getByText('Insufficient access permissions.')).toBeInTheDocument();
    });
    it("shows warning if access roles aren't enabled", () => {
        renderWithDefaults({ enableAccessControl: false });
        expect(screen.getByText('Feature is disabled.')).toBeInTheDocument();
    });
    it('calls cancel', () => {
        renderWithDefaults();
        const cancelButton = screen.getByTestId('add-edit-role-cancel');
        cancelButton.click();
        expect(onCancelFc).toHaveBeenCalled();
    });
    it('role name is required', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithDefaults();
        const submitButton = screen.getByTestId('add-edit-role-submit');
        submitButton.click();
        expect(onSubmitFc).not.toHaveBeenCalled();
        yield waitFor(() => expect(screen.queryByText('Role name is required')).toBeInTheDocument());
    }));
    it('calls submit', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithDefaults();
        const titleField = screen.getByTestId('role-name-field');
        fireEvent.change(titleField, { target: { value: 'Role Title' } });
        const submitButton = screen.getByTestId('add-edit-role-submit');
        submitButton.click();
        yield waitFor(() => expect(onSubmitFc).toHaveBeenCalled());
    }));
});
//# sourceMappingURL=AddEditRoleForm.test.js.map