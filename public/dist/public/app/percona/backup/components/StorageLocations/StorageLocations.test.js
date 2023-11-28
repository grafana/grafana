import { __awaiter } from "tslib";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { StorageLocations } from './StorageLocations';
import { StorageLocationsService } from './StorageLocations.service';
import { stubLocations } from './__mocks__/StorageLocations.service';
jest.mock('./StorageLocations.service');
jest.mock('app/core/app_events');
describe('StorageLocations', () => {
    it('should show delete modal when icon is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: false },
                    settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
                },
            }) },
            React.createElement(StorageLocations, null)));
        yield screen.findByText('first location');
        const btn = screen.getAllByTestId('dropdown-menu-toggle')[0];
        yield waitFor(() => fireEvent.click(btn));
        const deleteBtn = screen.getAllByTestId('dropdown-button')[1];
        yield waitFor(() => fireEvent.click(deleteBtn));
        expect(screen.getByText(/Are you sure you want to delete the Storage Location/i)).toBeTruthy();
    }));
    it('should close delete modal after deletion confirmation', () => __awaiter(void 0, void 0, void 0, function* () {
        const spy = jest.spyOn(StorageLocationsService, 'delete');
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: false },
                    settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
                },
            }) },
            React.createElement(StorageLocations, null)));
        yield screen.findByText('first location');
        const btn = screen.getAllByTestId('dropdown-menu-toggle')[0];
        yield waitFor(() => fireEvent.click(btn));
        const deleteBtn = screen.getAllByTestId('dropdown-button')[1];
        yield waitFor(() => fireEvent.click(deleteBtn));
        expect(screen.getByText('Delete Storage Location')).toBeTruthy();
        fireEvent.submit(screen.getByTestId('confirm-delete-modal-button'));
        yield screen.findByText('first location');
        expect(screen.queryByText('Delete Storage Location')).toBeFalsy();
        expect(spy).toHaveBeenCalledWith(stubLocations.locations[0].location_id, false);
    }));
    it('should open the modal by clicking the "Add" button', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
                },
            }) },
            React.createElement(StorageLocations, null))));
        yield screen.findByText('first location');
        expect(screen.queryByText('Add Storage Location')).toBeFalsy();
        yield waitFor(() => fireEvent.click(screen.getAllByTestId('storage-location-add-modal-button')[0]));
        expect(screen.getByText('Add Storage Location')).toBeTruthy();
    }));
});
//# sourceMappingURL=StorageLocations.test.js.map