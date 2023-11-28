import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { PluginExtensionPoints, PluginExtensionTypes } from '@grafana/data';
import { getPluginLinkExtensions } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { createEmptyQueryResponse } from '../state/utils';
import { ToolbarExtensionPoint } from './ToolbarExtensionPoint';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getPluginLinkExtensions: jest.fn() })));
jest.mock('app/core/services/context_srv');
const contextSrvMock = jest.mocked(contextSrv);
const getPluginLinkExtensionsMock = jest.mocked(getPluginLinkExtensions);
function renderWithExploreStore(children, options = { targets: [{ refId: 'A' }], data: createEmptyQueryResponse() }) {
    const { targets, data } = options;
    const store = configureStore({
        explore: {
            panes: {
                left: {
                    queries: targets,
                    queryResponse: data,
                    range: {
                        raw: { from: 'now-1h', to: 'now' },
                    },
                },
            },
        },
    });
    render(React.createElement(Provider, { store: store }, children), {});
}
describe('ToolbarExtensionPoint', () => {
    describe('with extension points', () => {
        beforeAll(() => {
            getPluginLinkExtensionsMock.mockReturnValue({
                extensions: [
                    {
                        pluginId: 'grafana',
                        id: '1',
                        type: PluginExtensionTypes.link,
                        title: 'Add to dashboard',
                        category: 'Dashboards',
                        description: 'Add the current query as a panel to a dashboard',
                        onClick: jest.fn(),
                    },
                    {
                        pluginId: 'grafana-ml-app',
                        id: '2',
                        type: PluginExtensionTypes.link,
                        title: 'ML: Forecast',
                        description: 'Add the query as a ML forecast',
                        path: '/a/grafana-ml-ap/forecast',
                    },
                ],
            });
        });
        it('should render "Add" extension point menu button', () => {
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: "left", timeZone: "browser", splitted: false }));
            expect(screen.getByRole('button', { name: 'Add' })).toBeVisible();
        });
        it('should render menu with extensions when "Add" is clicked in split mode', () => __awaiter(void 0, void 0, void 0, function* () {
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: 'left', timeZone: "browser", splitted: true }));
            yield userEvent.click(screen.getByRole('button', { name: 'Add' }));
            expect(screen.getByRole('group', { name: 'Dashboards' })).toBeVisible();
            expect(screen.getByRole('menuitem', { name: 'Add to dashboard' })).toBeVisible();
            expect(screen.getByRole('menuitem', { name: 'ML: Forecast' })).toBeVisible();
        }));
        it('should render menu with extensions when "Add" is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: "left", timeZone: "browser", splitted: false }));
            yield userEvent.click(screen.getByRole('button', { name: 'Add' }));
            expect(screen.getByRole('group', { name: 'Dashboards' })).toBeVisible();
            expect(screen.getByRole('menuitem', { name: 'Add to dashboard' })).toBeVisible();
            expect(screen.getByRole('menuitem', { name: 'ML: Forecast' })).toBeVisible();
        }));
        it('should call onClick from extension when menu item is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: "left", timeZone: "browser", splitted: false }));
            yield userEvent.click(screen.getByRole('button', { name: 'Add' }));
            yield userEvent.click(screen.getByRole('menuitem', { name: 'Add to dashboard' }));
            const { extensions } = getPluginLinkExtensions({ extensionPointId: PluginExtensionPoints.ExploreToolbarAction });
            const [extension] = extensions;
            expect(jest.mocked(extension.onClick)).toBeCalledTimes(1);
        }));
        it('should render confirm navigation modal when extension with path is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: "left", timeZone: "browser", splitted: false }));
            yield userEvent.click(screen.getByRole('button', { name: 'Add' }));
            yield userEvent.click(screen.getByRole('menuitem', { name: 'ML: Forecast' }));
            expect(screen.getByRole('button', { name: 'Open in new tab' })).toBeVisible();
            expect(screen.getByRole('button', { name: 'Open' })).toBeVisible();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
        }));
        it('should pass a correct constructed context when fetching extensions', () => __awaiter(void 0, void 0, void 0, function* () {
            const targets = [{ refId: 'A' }];
            const data = createEmptyQueryResponse();
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: "left", timeZone: "browser", splitted: false }), {
                targets,
                data,
            });
            const [options] = getPluginLinkExtensionsMock.mock.calls[0];
            const { context } = options;
            expect(context).toEqual({
                exploreId: 'left',
                targets,
                data: expect.objectContaining(Object.assign(Object.assign({}, data), { timeRange: expect.any(Object) })),
                timeZone: 'browser',
                timeRange: { from: 'now-1h', to: 'now' },
                shouldShowAddCorrelation: false,
            });
        }));
        it('should pass a context with correct timeZone when fetching extensions', () => __awaiter(void 0, void 0, void 0, function* () {
            const targets = [{ refId: 'A' }];
            const data = createEmptyQueryResponse();
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: "left", timeZone: "", splitted: false }), {
                targets,
                data,
            });
            const [options] = getPluginLinkExtensionsMock.mock.calls[0];
            const { context } = options;
            expect(context).toHaveProperty('timeZone', 'browser');
        }));
        it('should correct extension point id when fetching extensions', () => __awaiter(void 0, void 0, void 0, function* () {
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: "left", timeZone: "browser", splitted: false }));
            const [options] = getPluginLinkExtensionsMock.mock.calls[0];
            const { extensionPointId } = options;
            expect(extensionPointId).toBe(PluginExtensionPoints.ExploreToolbarAction);
        }));
    });
    describe('with extension points without categories', () => {
        beforeAll(() => {
            getPluginLinkExtensionsMock.mockReturnValue({
                extensions: [
                    {
                        pluginId: 'grafana',
                        id: '1',
                        type: PluginExtensionTypes.link,
                        title: 'Dashboard',
                        description: 'Add the current query as a panel to a dashboard',
                        onClick: jest.fn(),
                    },
                    {
                        pluginId: 'grafana-ml-app',
                        id: '2',
                        type: PluginExtensionTypes.link,
                        title: 'ML: Forecast',
                        description: 'Add the query as a ML forecast',
                        path: '/a/grafana-ml-ap/forecast',
                    },
                ],
            });
        });
        it('should render "Add" extension point menu button', () => {
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: "left", timeZone: "browser", splitted: false }));
            expect(screen.getByRole('button', { name: 'Add' })).toBeVisible();
        });
        it('should render "Add" extension point menu button in split mode', () => __awaiter(void 0, void 0, void 0, function* () {
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: 'left', timeZone: "browser", splitted: true }));
            yield userEvent.click(screen.getByRole('button', { name: 'Add' }));
            // Make sure we don't have anything related to categories rendered
            expect(screen.queryAllByRole('group').length).toBe(0);
            expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toBeVisible();
            expect(screen.getByRole('menuitem', { name: 'ML: Forecast' })).toBeVisible();
        }));
        it('should render menu with extensions when "Add" is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: "left", timeZone: "browser", splitted: false }));
            yield userEvent.click(screen.getByRole('button', { name: 'Add' }));
            // Make sure we don't have anything related to categories rendered
            expect(screen.queryAllByRole('group').length).toBe(0);
            expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toBeVisible();
            expect(screen.getByRole('menuitem', { name: 'ML: Forecast' })).toBeVisible();
        }));
    });
    describe('without extension points', () => {
        beforeAll(() => {
            contextSrvMock.hasPermission.mockReturnValue(true);
            getPluginLinkExtensionsMock.mockReturnValue({ extensions: [] });
        });
        it('should render "add to dashboard" action button if one pane is visible', () => __awaiter(void 0, void 0, void 0, function* () {
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: "left", timeZone: "browser", splitted: false }));
            yield waitFor(() => {
                const button = screen.getByRole('button', { name: /add to dashboard/i });
                expect(button).toBeVisible();
                expect(button).toBeEnabled();
            });
        }));
    });
    describe('with insufficient permissions', () => {
        beforeAll(() => {
            contextSrvMock.hasPermission.mockReturnValue(false);
            getPluginLinkExtensionsMock.mockReturnValue({ extensions: [] });
        });
        it('should not render "add to dashboard" action button', () => __awaiter(void 0, void 0, void 0, function* () {
            renderWithExploreStore(React.createElement(ToolbarExtensionPoint, { exploreId: "left", timeZone: "browser", splitted: false }));
            expect(screen.queryByRole('button', { name: /add to dashboard/i })).not.toBeInTheDocument();
        }));
    });
});
//# sourceMappingURL=ToolbarExtensionPoint.test.js.map