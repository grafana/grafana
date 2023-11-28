import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { HistoryWrapper, locationService, setLocationService } from '@grafana/runtime';
import * as Reducers from 'app/percona/shared/core/reducers';
import * as RolesReducer from 'app/percona/shared/core/reducers/roles/roles';
import { configureStore } from 'app/store/configureStore';
import { stubRoles, stubUsers, stubUsersMap } from '../../../__mocks__/stubs';
import OptionsCell from './OptionsCell';
jest.mock('app/percona/shared/services/roles/Roles.service');
jest.mock('app/percona/settings/Settings.service');
const wrapWithProvider = (children) => (React.createElement(Provider, { store: configureStore({
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
const renderDefault = (isDefault = false) => render(wrapWithProvider(React.createElement(OptionsCell, { role: Object.assign(Object.assign({}, stubRoles[0]), { isDefault }) })));
describe('OptionsCell', () => {
    beforeEach(() => {
        setLocationService(new HistoryWrapper());
    });
    it('shows all options when role is not default', () => __awaiter(void 0, void 0, void 0, function* () {
        renderDefault();
        const optionsButton = screen.getByLabelText('Open role options');
        fireEvent.click(optionsButton);
        yield waitFor(() => expect(screen.queryByText('Edit')).toBeInTheDocument());
        yield waitFor(() => expect(screen.queryByText('Set as default')).toBeInTheDocument());
        yield waitFor(() => expect(screen.queryByText('Delete')).toBeInTheDocument());
    }));
    it('shows all options when role is default', () => __awaiter(void 0, void 0, void 0, function* () {
        renderDefault(true);
        const optionsButton = screen.getByLabelText('Open role options');
        fireEvent.click(optionsButton);
        yield waitFor(() => expect(screen.queryByText('Edit')).toBeInTheDocument());
        yield waitFor(() => expect(screen.queryByText('Set as default')).toBeNull());
        yield waitFor(() => expect(screen.queryByText('Delete')).toBeNull());
    }));
    it('navigates to edit page', () => __awaiter(void 0, void 0, void 0, function* () {
        renderDefault(true);
        const optionsButton = screen.getByLabelText('Open role options');
        fireEvent.click(optionsButton);
        yield waitFor(() => expect(screen.queryByText('Edit')).toBeInTheDocument());
        const editButton = screen.getByText('Edit');
        fireEvent.click(editButton);
        expect(locationService.getLocation().pathname).toBe('/roles/1/edit');
    }));
    it('sets role as default', () => __awaiter(void 0, void 0, void 0, function* () {
        const setAsDefaultRoleActionSpy = jest.spyOn(RolesReducer, 'setAsDefaultRoleAction');
        const fetchSettingsActionSpy = jest.spyOn(Reducers, 'fetchSettingsAction');
        renderDefault();
        const optionsButton = screen.getByLabelText('Open role options');
        fireEvent.click(optionsButton);
        yield waitFor(() => expect(screen.queryByText('Set as default')).toBeInTheDocument());
        const setDefaultButton = screen.getByText('Set as default');
        fireEvent.click(setDefaultButton);
        yield waitFor(() => expect(setAsDefaultRoleActionSpy).toHaveBeenCalled());
        yield waitFor(() => expect(fetchSettingsActionSpy).toHaveBeenCalled());
    }));
    it('opens delete modal when trying to delete', () => __awaiter(void 0, void 0, void 0, function* () {
        renderDefault();
        const optionsButton = screen.getByLabelText('Open role options');
        fireEvent.click(optionsButton);
        yield waitFor(() => expect(screen.queryByText('Delete')).toBeInTheDocument());
        const deleteButton = screen.getByText('Delete');
        fireEvent.click(deleteButton);
        yield waitFor(() => expect(screen.getByText('Delete "Role #1" role')).toBeInTheDocument());
    }));
});
//# sourceMappingURL=OptionsCell.test.js.map