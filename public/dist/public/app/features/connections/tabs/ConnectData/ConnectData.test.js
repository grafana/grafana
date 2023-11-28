import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { PluginType } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { getCatalogPluginMock, getPluginsStateMock } from 'app/features/plugins/admin/__mocks__';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { AddNewConnection } from './ConnectData';
jest.mock('app/features/datasources/api');
const renderPage = (plugins = []) => {
    // @ts-ignore
    const store = configureStore({ plugins: getPluginsStateMock(plugins) });
    return render(React.createElement(Provider, { store: store },
        React.createElement(AddNewConnection, null)));
};
const mockCatalogDataSourcePlugin = getCatalogPluginMock({
    type: PluginType.datasource,
    name: 'Sample data source',
    id: 'sample-data-source',
});
const originalHasPermission = contextSrv.hasPermission;
describe('Angular badge', () => {
    test('does not show angular badge for non-angular plugins', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPage([
            getCatalogPluginMock({
                id: 'react-plugin',
                name: 'React Plugin',
                type: PluginType.datasource,
                angularDetected: false,
            }),
        ]);
        yield waitFor(() => {
            expect(screen.queryByText('React Plugin')).toBeInTheDocument();
        });
        expect(screen.queryByText('Angular')).not.toBeInTheDocument();
    }));
    test('shows angular badge for angular plugins', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPage([
            getCatalogPluginMock({
                id: 'legacy-plugin',
                name: 'Legacy Plugin',
                type: PluginType.datasource,
                angularDetected: true,
            }),
        ]);
        yield waitFor(() => {
            expect(screen.queryByText('Legacy Plugin')).toBeInTheDocument();
        });
        expect(screen.queryByText('Angular')).toBeInTheDocument();
    }));
});
describe('Add new connection', () => {
    beforeEach(() => {
        contextSrv.hasPermission = originalHasPermission;
    });
    test('renders no results if the plugins list is empty', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPage();
        expect(screen.queryByText('No results matching your query were found.')).toBeInTheDocument();
    }));
    test('renders no results if there is no data source plugin in the list', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPage([getCatalogPluginMock()]);
        expect(screen.queryByText('No results matching your query were found.')).toBeInTheDocument();
    }));
    test('renders only data source plugins when list is populated', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);
        expect(yield screen.findByText('Sample data source')).toBeVisible();
    }));
    test('renders card if search term matches', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);
        const searchField = yield screen.findByRole('textbox');
        fireEvent.change(searchField, { target: { value: 'ampl' } });
        expect(yield screen.findByText('Sample data source')).toBeVisible();
        fireEvent.change(searchField, { target: { value: 'cramp' } });
        expect(screen.queryByText('No results matching your query were found.')).toBeInTheDocument();
    }));
    test('shows a "No access" modal if the user does not have permissions to create datasources', () => __awaiter(void 0, void 0, void 0, function* () {
        contextSrv.hasPermission = jest.fn().mockImplementation((permission) => {
            if (permission === AccessControlAction.DataSourcesCreate) {
                return false;
            }
            return true;
        });
        renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);
        const exampleSentenceInModal = 'Editors cannot add new connections.';
        // Should not show the modal by default
        expect(screen.queryByText(new RegExp(exampleSentenceInModal))).not.toBeInTheDocument();
        // Should show the modal if the user has no permissions
        fireEvent.click(yield screen.findByText('Sample data source'));
        expect(screen.queryByText(new RegExp(exampleSentenceInModal))).toBeInTheDocument();
    }));
    test('does not show a "No access" modal but displays the details page if the user has the right permissions', () => __awaiter(void 0, void 0, void 0, function* () {
        contextSrv.hasPermission = jest.fn().mockReturnValue(true);
        renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);
        const exampleSentenceInModal = 'Editors cannot add new connections.';
        // Should not show the modal by default
        expect(screen.queryByText(new RegExp(exampleSentenceInModal))).not.toBeInTheDocument();
        // Should not show the modal when clicking a card
        fireEvent.click(yield screen.findByText('Sample data source'));
        expect(screen.queryByText(new RegExp(exampleSentenceInModal))).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=ConnectData.test.js.map