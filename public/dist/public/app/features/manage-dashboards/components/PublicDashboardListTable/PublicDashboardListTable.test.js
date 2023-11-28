import { __awaiter } from "tslib";
import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import 'whatwg-fetch';
import { BrowserRouter } from 'react-router-dom';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { PublicDashboardListTable } from './PublicDashboardListTable';
const publicDashboardListResponse = [
    {
        uid: 'SdZwuCZVz',
        accessToken: 'beeaf92f6ab3467f80b2be922c7741ab',
        title: 'New dashboardasdf',
        dashboardUid: 'iF36Qb6nz',
        isEnabled: false,
    },
    {
        uid: 'EuiEbd3nz',
        accessToken: '8687b0498ccf4babb2f92810d8563b33',
        title: 'New dashboard',
        dashboardUid: 'kFlxbd37k',
        isEnabled: true,
    },
];
const orphanedDashboardListResponse = [
    {
        uid: 'SdZwuCZVz2',
        accessToken: 'beeaf92f6ab3467f80b2be922c7741ab',
        title: '',
        dashboardUid: '',
        isEnabled: false,
    },
    {
        uid: 'EuiEbd3nz2',
        accessToken: '8687b0498ccf4babb2f92810d8563b33',
        title: '',
        dashboardUid: '',
        isEnabled: true,
    },
];
const paginationResponse = {
    page: 1,
    perPage: 50,
    totalCount: 50,
};
const server = setupServer(rest.get('/api/dashboards/public-dashboards', (_, res, ctx) => res(ctx.status(200), ctx.json(Object.assign(Object.assign({}, paginationResponse), { publicDashboards: publicDashboardListResponse })))), rest.delete('/api/dashboards/uid/:dashboardUid/public-dashboards/:uid', (_, res, ctx) => res(ctx.status(200))));
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv })));
beforeAll(() => {
    server.listen({ onUnhandledRequest: 'bypass' });
});
afterAll(() => {
    server.close();
});
afterEach(() => {
    jest.restoreAllMocks();
    server.resetHandlers();
});
const selectors = e2eSelectors.pages.PublicDashboards;
const renderPublicDashboardTable = (waitForListRendering) => __awaiter(void 0, void 0, void 0, function* () {
    const context = getGrafanaContextMock();
    render(React.createElement(TestProvider, { grafanaContext: context },
        React.createElement(BrowserRouter, null,
            React.createElement(PublicDashboardListTable, null))));
    waitForListRendering && (yield waitForElementToBeRemoved(screen.getAllByTestId('Spinner')[1], { timeout: 3000 }));
});
describe('Show table', () => {
    it('renders loader spinner while loading', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderPublicDashboardTable();
        const spinner = screen.getAllByTestId('Spinner')[1];
        expect(spinner).toBeInTheDocument();
        yield waitForElementToBeRemoved(spinner);
    }));
    it('renders public dashboard list items', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderPublicDashboardTable(true);
        expect(screen.getAllByRole('listitem')).toHaveLength(publicDashboardListResponse.length);
    }));
    it('renders empty list', () => __awaiter(void 0, void 0, void 0, function* () {
        const emptyListRS = {
            publicDashboards: [],
            totalCount: 0,
            page: 1,
            perPage: 50,
        };
        server.use(rest.get('/api/dashboards/public-dashboards', (req, res, ctx) => {
            return res(ctx.status(200), ctx.json(emptyListRS));
        }));
        yield renderPublicDashboardTable(true);
        expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    }));
    it('renders public dashboards in a good way without trashcan', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
        yield renderPublicDashboardTable(true);
        publicDashboardListResponse.forEach((pd, idx) => {
            renderPublicDashboardItemCorrectly(pd, idx, false);
        });
    }));
    it('renders public dashboards in a good way with trashcan', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
        yield renderPublicDashboardTable(true);
        publicDashboardListResponse.forEach((pd, idx) => {
            renderPublicDashboardItemCorrectly(pd, idx, true);
        });
    }));
});
describe('Delete public dashboard', () => {
    it('when user does not have public dashboard write permissions, then dashboards are listed without delete button', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
        yield renderPublicDashboardTable(true);
        expect(screen.queryAllByTestId(selectors.ListItem.trashcanButton)).toHaveLength(0);
    }));
    it('when user has public dashboard write permissions, then dashboards are listed with delete button', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
        yield renderPublicDashboardTable(true);
        expect(screen.getAllByTestId(selectors.ListItem.trashcanButton)).toHaveLength(publicDashboardListResponse.length);
    }));
});
describe('Orphaned public dashboard', () => {
    it('renders orphaned and non orphaned public dashboards items correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = Object.assign(Object.assign({}, paginationResponse), { publicDashboards: [...publicDashboardListResponse, ...orphanedDashboardListResponse] });
        server.use(rest.get('/api/dashboards/public-dashboards', (req, res, ctx) => {
            return res(ctx.status(200), ctx.json(response));
        }));
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
        yield renderPublicDashboardTable(true);
        response.publicDashboards.forEach((pd, idx) => {
            renderPublicDashboardItemCorrectly(pd, idx, true);
        });
    }));
});
const renderPublicDashboardItemCorrectly = (pd, idx, hasWriteAccess) => {
    const isOrphaned = !pd.dashboardUid;
    const cardItems = screen.getAllByRole('listitem');
    const linkButton = within(cardItems[idx]).getByTestId(selectors.ListItem.linkButton);
    const configButton = within(cardItems[idx]).getByTestId(selectors.ListItem.configButton);
    const trashcanButton = within(cardItems[idx]).queryByTestId(selectors.ListItem.trashcanButton);
    expect(within(cardItems[idx]).getByText(isOrphaned ? 'Orphaned public dashboard' : pd.title)).toBeInTheDocument();
    isOrphaned
        ? expect(linkButton).toHaveStyle('pointer-events: none')
        : expect(linkButton).not.toHaveStyle('pointer-events: none');
    isOrphaned
        ? expect(configButton).toHaveStyle('pointer-events: none')
        : expect(configButton).not.toHaveStyle('pointer-events: none');
    hasWriteAccess ? expect(trashcanButton).toBeEnabled() : expect(trashcanButton).toBeNull();
};
//# sourceMappingURL=PublicDashboardListTable.test.js.map