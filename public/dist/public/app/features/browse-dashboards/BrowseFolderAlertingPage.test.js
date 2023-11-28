import { __awaiter } from "tslib";
import 'whatwg-fetch'; // fetch polyfill
import { render as rtlRender, screen } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { contextSrv } from 'app/core/core';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { backendSrv } from 'app/core/services/backend_srv';
import BrowseFolderAlertingPage from './BrowseFolderAlertingPage';
import { getPrometheusRulesResponse, getRulerRulesResponse } from './fixtures/alertRules.fixture';
import * as permissions from './permissions';
function render(...[ui, options]) {
    rtlRender(React.createElement(TestProvider, null, ui), options);
}
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv, config: Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime').config), { unifiedAlertingEnabled: true }) })));
const mockFolderName = 'myFolder';
const mockFolderUid = '12345';
const mockRulerRulesResponse = getRulerRulesResponse(mockFolderName, mockFolderUid);
const mockPrometheusRulesResponse = getPrometheusRulesResponse(mockFolderName);
describe('browse-dashboards BrowseFolderAlertingPage', () => {
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
                title: mockFolderName,
                uid: mockFolderUid,
            }));
        }), rest.get('api/ruler/grafana/api/v1/rules', (_, res, ctx) => {
            return res(ctx.status(200), ctx.json(mockRulerRulesResponse));
        }), rest.get('api/prometheus/grafana/api/v1/rules', (_, res, ctx) => {
            return res(ctx.status(200), ctx.json(mockPrometheusRulesResponse));
        }));
        server.listen();
    });
    afterAll(() => {
        server.close();
    });
    beforeEach(() => {
        jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => mockPermissions);
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
        props = Object.assign({}, getRouteComponentProps({
            match: {
                params: {
                    uid: mockFolderUid,
                },
                isExact: false,
                path: '',
                url: '',
            },
        }));
    });
    afterEach(() => {
        jest.restoreAllMocks();
        server.resetHandlers();
    });
    it('displays the folder title', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(BrowseFolderAlertingPage, Object.assign({}, props)));
        expect(yield screen.findByRole('heading', { name: mockFolderName })).toBeInTheDocument();
    }));
    it('displays the "Folder actions" button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(BrowseFolderAlertingPage, Object.assign({}, props)));
        expect(yield screen.findByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
    }));
    it('does not display the "Folder actions" button if the user does not have permissions', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
            return Object.assign(Object.assign({}, mockPermissions), { canDeleteFolders: false, canEditFolders: false, canViewPermissions: false, canSetPermissions: false });
        });
        render(React.createElement(BrowseFolderAlertingPage, Object.assign({}, props)));
        expect(yield screen.findByRole('heading', { name: mockFolderName })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
    }));
    it('displays all the folder tabs and shows the "Alert rules" tab as selected', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(BrowseFolderAlertingPage, Object.assign({}, props)));
        expect(yield screen.findByRole('tab', { name: 'Tab Dashboards' })).toBeInTheDocument();
        expect(yield screen.findByRole('tab', { name: 'Tab Dashboards' })).toHaveAttribute('aria-selected', 'false');
        expect(yield screen.findByRole('tab', { name: 'Tab Panels' })).toBeInTheDocument();
        expect(yield screen.findByRole('tab', { name: 'Tab Panels' })).toHaveAttribute('aria-selected', 'false');
        expect(yield screen.findByRole('tab', { name: 'Tab Alert rules' })).toBeInTheDocument();
        expect(yield screen.findByRole('tab', { name: 'Tab Alert rules' })).toHaveAttribute('aria-selected', 'true');
    }));
    it('displays the alert rules returned by the API', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(BrowseFolderAlertingPage, Object.assign({}, props)));
        const ruleName = mockPrometheusRulesResponse.data.groups[0].rules[0].name;
        expect(yield screen.findByRole('link', { name: ruleName })).toBeInTheDocument();
    }));
});
//# sourceMappingURL=BrowseFolderAlertingPage.test.js.map