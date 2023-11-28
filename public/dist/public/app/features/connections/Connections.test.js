import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getMockDataSources } from 'app/features/datasources/__mocks__';
import * as api from 'app/features/datasources/api';
import { configureStore } from 'app/store/configureStore';
import { getPluginsStateMock } from '../plugins/admin/__mocks__';
import Connections from './Connections';
import { navIndex } from './__mocks__/store.navIndex.mock';
import { ROUTE_BASE_ID, ROUTES } from './constants';
jest.mock('app/core/services/context_srv');
jest.mock('app/features/datasources/api');
const renderPage = (path = `/${ROUTE_BASE_ID}`, store = configureStore({ navIndex, plugins: getPluginsStateMock([]) })) => {
    locationService.push(path);
    return render(React.createElement(TestProvider, { store: store },
        React.createElement(Connections, null)));
};
describe('Connections', () => {
    const mockDatasources = getMockDataSources(3);
    beforeEach(() => {
        api.getDataSources = jest.fn().mockResolvedValue(mockDatasources);
        contextSrv.hasPermission = jest.fn().mockReturnValue(true);
    });
    test('shows the "Add new connection" page by default', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPage();
        // Data sources group
        expect(yield screen.findByText('Data sources')).toBeVisible();
        // Heading
        expect(yield screen.findByText('Add new connection')).toBeVisible();
        expect(yield screen.findByText('Browse and create new connections')).toBeVisible();
    }));
    test('renders the correct tab even if accessing it with a "sub-url"', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPage(ROUTES.AddNewConnection);
        expect(yield screen.findByText('Add new connection')).toBeVisible();
        expect(yield screen.findByText('Browse and create new connections')).toBeVisible();
        // Should not render the "datasources" page
        expect(screen.queryByText('Manage your existing datasource connections')).not.toBeInTheDocument();
    }));
    test('renders the core "Add new connection" page in case there is no standalone plugin page override for it', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPage(ROUTES.AddNewConnection);
        // We expect to see no results and "Data sources" as a header (we only have data sources in OSS Grafana at this point)
        expect(yield screen.findByText('Data sources')).toBeVisible();
        expect(yield screen.findByText('No results matching your query were found.')).toBeVisible();
    }));
    test('does not render anything for the "Add new connection" page in case it is displayed by a standalone plugin page', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // We are overriding the navIndex to have the "Add new connection" page registered by a plugin
        const standalonePluginPage = {
            id: 'standalone-plugin-page-/connections/add-new-connection',
            text: 'Add new connection',
            subTitle: 'Browse and create new connections',
            url: '/connections/add-new-connection',
            pluginId: 'grafana-easystart-app',
        };
        const connections = Object.assign(Object.assign({}, navIndex.connections), { children: (_a = navIndex.connections.children) === null || _a === void 0 ? void 0 : _a.map((child) => {
                if (child.id === 'connections-add-new-connection') {
                    return standalonePluginPage;
                }
                return child;
            }) });
        const store = configureStore({
            navIndex: Object.assign(Object.assign({}, navIndex), { connections, [standalonePluginPage.id]: standalonePluginPage }),
            plugins: getPluginsStateMock([]),
        });
        renderPage(ROUTES.AddNewConnection, store);
        // We expect not to see the text that would be rendered by the core "Add new connection" page
        expect(screen.queryByText('Data sources')).not.toBeInTheDocument();
        expect(screen.queryByText('No results matching your query were found.')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=Connections.test.js.map