import { __awaiter } from "tslib";
import 'whatwg-fetch'; // fetch polyfill
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectors } from '@grafana/e2e-selectors';
import { contextSrv } from 'app/core/core';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { backendSrv } from 'app/core/services/backend_srv';
import BrowseDashboardsPage from './BrowseDashboardsPage';
import { wellFormedTree } from './fixtures/dashboardsTreeItem.fixture';
import * as permissions from './permissions';
const [mockTree, { dashbdD, folderA, folderA_folderA }] = wellFormedTree();
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv, config: Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime').config), { unifiedAlertingEnabled: true }) })));
jest.mock('react-virtualized-auto-sizer', () => {
    return {
        __esModule: true,
        default(props) {
            return React.createElement("div", null, props.children({ width: 800, height: 600 }));
        },
    };
});
function render(...[ui, options]) {
    const { rerender } = rtlRender(React.createElement(TestProvider, { storeState: {
            navIndex: {
                'dashboards/browse': {
                    text: 'Dashboards',
                    id: 'dashboards/browse',
                },
            },
        } }, ui), options);
    const wrappedRerender = (ui) => {
        rerender(React.createElement(TestProvider, { storeState: {
                navIndex: {
                    'dashboards/browse': {
                        text: 'Dashboards',
                        id: 'dashboards/browse',
                    },
                },
            } }, ui));
    };
    return {
        rerender: wrappedRerender,
    };
}
jest.mock('app/features/browse-dashboards/api/services', () => {
    const orig = jest.requireActual('app/features/browse-dashboards/api/services');
    return Object.assign(Object.assign({}, orig), { listFolders(parentUID) {
            const childrenForUID = mockTree
                .filter((v) => v.item.kind === 'folder' && v.item.parentUID === parentUID)
                .map((v) => v.item);
            return Promise.resolve(childrenForUID);
        },
        listDashboards(parentUID) {
            const childrenForUID = mockTree
                .filter((v) => v.item.kind === 'dashboard' && v.item.parentUID === parentUID)
                .map((v) => v.item);
            return Promise.resolve(childrenForUID);
        } });
});
describe('browse-dashboards BrowseDashboardsPage', () => {
    let props;
    let server;
    const mockPermissions = {
        canCreateDashboards: true,
        canEditDashboards: true,
        canCreateFolders: true,
        canDeleteFolders: true,
        canEditFolders: true,
        canViewPermissions: true,
        canSetPermissions: true,
    };
    beforeAll(() => {
        server = setupServer(rest.get('/api/folders/:uid', (_, res, ctx) => {
            return res(ctx.status(200), ctx.json({
                title: folderA.item.title,
                uid: folderA.item.uid,
            }));
        }), rest.get('/api/search', (_, res, ctx) => {
            return res(ctx.status(200), ctx.json({}));
        }), rest.get('/api/search/sorting', (_, res, ctx) => {
            return res(ctx.status(200), ctx.json({
                sortOptions: [],
            }));
        }));
        server.listen();
    });
    afterAll(() => {
        server.close();
    });
    beforeEach(() => {
        props = Object.assign({}, getRouteComponentProps());
        jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => mockPermissions);
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    });
    afterEach(() => {
        jest.restoreAllMocks();
        server.resetHandlers();
    });
    describe('at the root level', () => {
        it('displays "Dashboards" as the page title', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
        }));
        it('displays a search input', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByPlaceholderText('Search for dashboards and folders')).toBeInTheDocument();
        }));
        it('shows the "New" button', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('button', { name: 'New' })).toBeInTheDocument();
        }));
        it('does not show the "New" button if the user does not have permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canCreateDashboards: false, canCreateFolders: false });
            });
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
        }));
        it('does not show "Folder actions"', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
        }));
        it('does not show an "Edit title" button', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Edit title' })).not.toBeInTheDocument();
        }));
        it('does not show any tabs', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
            expect(screen.queryByRole('tab', { name: 'Tab Dashboards' })).not.toBeInTheDocument();
            expect(screen.queryByRole('tab', { name: 'Tab Panels' })).not.toBeInTheDocument();
            expect(screen.queryByRole('tab', { name: 'Tab Alert rules' })).not.toBeInTheDocument();
        }));
        it('displays the filters and hides the actions initially', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            yield screen.findByPlaceholderText('Search for dashboards and folders');
            expect(yield screen.findByText('Sort')).toBeInTheDocument();
            expect(yield screen.findByText('Filter by tag')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
        }));
        it('selecting an item hides the filters and shows the actions instead', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            const checkbox = yield screen.findByTestId(selectors.pages.BrowseDashboards.table.checkbox(dashbdD.item.uid));
            yield userEvent.click(checkbox);
            // Check the filters are now hidden
            expect(screen.queryByText('Filter by tag')).not.toBeInTheDocument();
            expect(screen.queryByText('Sort')).not.toBeInTheDocument();
            // Check the actions are now visible
            expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
        }));
        it('navigating into a child item resets the selected state', () => __awaiter(void 0, void 0, void 0, function* () {
            const { rerender } = render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            const checkbox = yield screen.findByTestId(selectors.pages.BrowseDashboards.table.checkbox(folderA.item.uid));
            yield userEvent.click(checkbox);
            // Check the actions are now visible
            expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
            const updatedProps = Object.assign({}, props);
            updatedProps.match.params = { uid: folderA.item.uid };
            rerender(React.createElement(BrowseDashboardsPage, Object.assign({}, updatedProps)));
            // Check the filters are now visible again
            expect(yield screen.findByText('Filter by tag')).toBeInTheDocument();
            expect(yield screen.findByText('Sort')).toBeInTheDocument();
            // Check the actions are no longer visible
            expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
        }));
    });
    describe('for a child folder', () => {
        beforeEach(() => {
            props.match.params = { uid: folderA.item.uid };
        });
        it('shows the folder name as the page title', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
        }));
        it('displays a search input', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByPlaceholderText('Search for dashboards and folders')).toBeInTheDocument();
        }));
        it('shows the "New" button', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('button', { name: 'New' })).toBeInTheDocument();
        }));
        it('does not show the "New" button if the user does not have permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canCreateDashboards: false, canCreateFolders: false });
            });
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
        }));
        it('shows the "Folder actions" button', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
        }));
        it('does not show the "Folder actions" button if the user does not have permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canDeleteFolders: false, canEditFolders: false, canSetPermissions: false, canViewPermissions: false });
            });
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
        }));
        it('shows an "Edit title" button', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('button', { name: 'Edit title' })).toBeInTheDocument();
        }));
        it('does not show the "Edit title" button if the user does not have permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canEditFolders: false });
            });
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Edit title' })).not.toBeInTheDocument();
        }));
        it('displays all the folder tabs and shows the "Dashboards" tab as selected', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            expect(yield screen.findByRole('tab', { name: 'Tab Dashboards' })).toBeInTheDocument();
            expect(yield screen.findByRole('tab', { name: 'Tab Dashboards' })).toHaveAttribute('aria-selected', 'true');
            expect(yield screen.findByRole('tab', { name: 'Tab Panels' })).toBeInTheDocument();
            expect(yield screen.findByRole('tab', { name: 'Tab Panels' })).toHaveAttribute('aria-selected', 'false');
            expect(yield screen.findByRole('tab', { name: 'Tab Alert rules' })).toBeInTheDocument();
            expect(yield screen.findByRole('tab', { name: 'Tab Alert rules' })).toHaveAttribute('aria-selected', 'false');
        }));
        it('displays the filters and hides the actions initially', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            yield screen.findByPlaceholderText('Search for dashboards and folders');
            expect(yield screen.findByText('Sort')).toBeInTheDocument();
            expect(yield screen.findByText('Filter by tag')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
        }));
        it('selecting an item hides the filters and shows the actions instead', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(BrowseDashboardsPage, Object.assign({}, props)));
            const checkbox = yield screen.findByTestId(selectors.pages.BrowseDashboards.table.checkbox(folderA_folderA.item.uid));
            yield userEvent.click(checkbox);
            // Check the filters are now hidden
            expect(screen.queryByText('Filter by tag')).not.toBeInTheDocument();
            expect(screen.queryByText('Sort')).not.toBeInTheDocument();
            // Check the actions are now visible
            expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
        }));
    });
});
//# sourceMappingURL=BrowseDashboardsPage.test.js.map