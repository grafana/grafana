import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import DashboardsTable from './DashboardsTable';
const props = {
    dashboards: [],
    onImport: jest.fn(),
    onRemove: jest.fn(),
};
const setup = (propOverrides) => {
    Object.assign(props, propOverrides);
    render(React.createElement(DashboardsTable, Object.assign({}, props)));
};
describe('DashboardsTable', () => {
    let mockDashboard;
    beforeEach(() => {
        mockDashboard = {
            dashboardId: 0,
            description: '',
            folderId: 0,
            imported: false,
            importedRevision: 0,
            importedUri: '',
            importedUrl: '',
            path: 'dashboards/carbon_metrics.json',
            pluginId: 'graphite',
            removed: false,
            revision: 0,
            slug: '',
            title: 'Graphite Carbon Metrics',
            uid: '',
        };
    });
    it('should render with no dashboards provided', () => {
        expect(() => setup()).not.toThrow();
        expect(screen.queryAllByRole('row').length).toEqual(0);
    });
    it('should render a row for each dashboard provided', () => {
        const mockDashboards = [mockDashboard, Object.assign(Object.assign({}, mockDashboard), { title: 'Graphite Carbon Metrics 2' })];
        setup({
            dashboards: mockDashboards,
        });
        expect(screen.getAllByRole('row').length).toEqual(2);
        mockDashboards.forEach((dashboard) => {
            expect(screen.getByRole('cell', { name: dashboard.title })).toBeInTheDocument();
        });
    });
    it('shows an import button if the dashboard has not been imported yet', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDashboards = [mockDashboard];
        setup({
            dashboards: mockDashboards,
        });
        const importButton = screen.getByRole('button', { name: 'Import' });
        expect(importButton).toBeInTheDocument();
        yield userEvent.click(importButton);
        expect(props.onImport).toHaveBeenCalledWith(mockDashboards[0], false);
    }));
    it('shows a re-import button if the dashboard has been imported and the revision id has not changed', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDashboards = [Object.assign(Object.assign({}, mockDashboard), { imported: true })];
        setup({
            dashboards: mockDashboards,
        });
        const reimportButton = screen.getByRole('button', { name: 'Re-import' });
        expect(reimportButton).toBeInTheDocument();
        yield userEvent.click(reimportButton);
        expect(props.onImport).toHaveBeenCalledWith(mockDashboards[0], true);
    }));
    it('shows an update button if the dashboard has been imported and the revision id has changed', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDashboards = [Object.assign(Object.assign({}, mockDashboard), { imported: true, revision: 1 })];
        setup({
            dashboards: mockDashboards,
        });
        const updateButton = screen.getByRole('button', { name: 'Update' });
        expect(updateButton).toBeInTheDocument();
        yield userEvent.click(updateButton);
        expect(props.onImport).toHaveBeenCalledWith(mockDashboards[0], true);
    }));
    it('shows a delete button if the dashboard has been imported', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDashboards = [Object.assign(Object.assign({}, mockDashboard), { imported: true })];
        setup({
            dashboards: mockDashboards,
        });
        const deleteButton = screen.getByRole('button', { name: 'Delete dashboard' });
        expect(deleteButton).toBeInTheDocument();
        yield userEvent.click(deleteButton);
        expect(props.onRemove).toHaveBeenCalledWith(mockDashboards[0]);
    }));
});
//# sourceMappingURL=DashboardsTable.test.js.map