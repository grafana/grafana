import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { getMockDashboard } from '../__mocks__';
import { DataSourceDashboardsView } from './DataSourceDashboards';
const setup = ({ dashboards = [], isLoading = false, onImportDashboard = jest.fn(), onRemoveDashboard = jest.fn(), }) => {
    const store = configureStore();
    return render(React.createElement(Provider, { store: store },
        React.createElement(DataSourceDashboardsView, { isLoading: isLoading, dashboards: dashboards, onImportDashboard: onImportDashboard, onRemoveDashboard: onRemoveDashboard })));
};
describe('<DataSourceDashboards>', () => {
    it('should show a loading indicator while loading', () => {
        setup({ isLoading: true });
        expect(screen.queryByText(/loading/i)).toBeVisible();
    });
    it('should not show a loading indicator when loaded', () => {
        setup({ isLoading: false });
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
    it('should show a list of dashboards once loaded', () => {
        setup({
            dashboards: [getMockDashboard({ title: 'My Dashboard 1' }), getMockDashboard({ title: 'My Dashboard 2' })],
        });
        expect(screen.queryByText('My Dashboard 1')).toBeVisible();
        expect(screen.queryByText('My Dashboard 2')).toBeVisible();
    });
});
//# sourceMappingURL=DataSourceDashboards.test.js.map