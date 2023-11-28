import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { configureStore } from 'app/store/configureStore';
import { LocationType } from '../StorageLocations/StorageLocations.types';
import AddBackupPage from './AddBackupPage';
import { Messages } from './AddBackupPage.messages';
jest.mock('../ScheduledBackups/ScheduledBackups.service');
jest.mock('../BackupInventory/BackupInventory.service');
jest.mock('./AddBackupPage.service');
jest.mock('app/percona/backup/components/StorageLocations/StorageLocations.service');
const AddBackupPageWrapper = ({ children }) => {
    return (React.createElement(Provider, { store: configureStore({
            percona: {
                user: { isAuthorized: true, isPlatformUser: false },
                settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
                backupLocations: {
                    result: [
                        {
                            locationID: 'location_1',
                            name: 'Location 1',
                            type: LocationType.S3,
                        },
                        {
                            locationID: 'location_2',
                            name: 'Location 2',
                            type: LocationType.CLIENT,
                        },
                    ],
                    loading: false,
                },
            },
        }) },
        React.createElement(Router, { history: locationService.getHistory() }, children)));
};
describe('AddBackupPage', () => {
    it('should render fields', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AddBackupPageWrapper, null,
            React.createElement(AddBackupPage, Object.assign({}, getRouteComponentProps({
                match: { params: { type: '', id: '' }, isExact: true, path: '', url: '' },
            })))));
        yield waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
        expect(screen.getAllByTestId('service-select-label')).toHaveLength(1);
        const textboxes = screen.getAllByRole('textbox');
        expect(textboxes.filter((textbox) => textbox.tagName === 'INPUT')).toHaveLength(2);
        expect(screen.queryByTestId('advanced-backup-fields')).not.toBeInTheDocument();
        expect(screen.queryByText(Messages.advanceSettings)).toBeInTheDocument();
        expect(screen.queryAllByText('Incremental')).toHaveLength(0);
        expect(screen.queryAllByText('Full')).toHaveLength(0);
    }));
    it('should render advanced fields when in schedule mode', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AddBackupPageWrapper, null,
            React.createElement(AddBackupPage, Object.assign({}, getRouteComponentProps({
                match: { params: { type: 'scheduled_task_id', id: '' }, isExact: true, path: '', url: '' },
            })))));
        yield waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
        expect(screen.getByTestId('advanced-backup-fields')).toBeInTheDocument();
        expect(screen.getByTestId('multi-select-field-div-wrapper').children).not.toHaveLength(0);
        expect(screen.queryByText(Messages.advanceSettings)).toBeInTheDocument();
    }));
    it('should render backup mode selector when in schedule mode', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AddBackupPageWrapper, null,
            React.createElement(AddBackupPage, Object.assign({}, getRouteComponentProps({
                match: { params: { type: 'scheduled_task_id', id: '' }, isExact: true, path: '', url: '' },
            })))));
        yield waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
        expect(screen.queryByText('Incremental')).toBeInTheDocument();
        expect(screen.queryByText('Full')).toBeInTheDocument();
    }));
    it('should render demand page backup without params', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AddBackupPageWrapper, null,
            React.createElement(AddBackupPage, Object.assign({}, getRouteComponentProps({
                match: { params: { type: '', id: '' }, isExact: true, path: '', url: '' },
            })))));
        yield waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
        expect(screen.getByText('Create Backup on demand')).toBeInTheDocument();
    }));
    it('should render schedule page backup with schedule params', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AddBackupPageWrapper, null,
            React.createElement(AddBackupPage, Object.assign({}, getRouteComponentProps({
                match: { params: { type: 'scheduled_task_id', id: '' }, isExact: true, path: '', url: '' },
            })))));
        yield waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
        expect(screen.getByText('Create Scheduled backup')).toBeInTheDocument();
    }));
    it('should switch page to schedule backup page when click on schedule backup button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AddBackupPageWrapper, null,
            React.createElement(AddBackupPage, Object.assign({}, getRouteComponentProps({
                match: { params: { type: '', id: '' }, isExact: true, path: '', url: '' },
            })))));
        yield waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
        const button = screen.getByText(Messages.schedule);
        yield fireEvent.click(button);
        expect(screen.getByText('Create Scheduled backup')).toBeInTheDocument();
    }));
    it('should switch back to demand backup page when click on demand backup button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AddBackupPageWrapper, null,
            React.createElement(AddBackupPage, Object.assign({}, getRouteComponentProps({
                match: { params: { type: 'scheduled_task_id', id: '' }, isExact: true, path: '', url: '' },
            })))));
        yield waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
        const button = screen.getByText(Messages.onDemand);
        yield fireEvent.click(button);
        expect(screen.getByText('Create Backup on demand')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=AddBackupPage.test.js.map