import { __awaiter } from "tslib";
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import 'whatwg-fetch';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { setEchoSrv } from '@grafana/runtime';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { trackDashboardSharingTypeOpen, trackDashboardSharingActionPerType } from '../analytics';
import { shareDashboardType } from '../utils';
import * as sharePublicDashboardUtils from './SharePublicDashboardUtils';
import { getExistentPublicDashboardResponse, mockDashboard, pubdashResponse, renderSharePublicDashboard, } from './utilsTest';
const server = setupServer();
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv })));
jest.mock('../analytics', () => (Object.assign(Object.assign({}, jest.requireActual('../analytics')), { trackDashboardSharingTypeOpen: jest.fn(), trackDashboardSharingActionPerType: jest.fn() })));
const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
let originalBootData;
beforeAll(() => {
    setEchoSrv(new Echo());
    originalBootData = config.bootData;
    config.appUrl = 'http://dashboards.grafana.com/';
    config.bootData = {
        user: {
            orgId: 1,
        },
        navTree: [
            {
                text: 'Section name',
                id: 'section',
                url: 'section',
                children: [
                    { text: 'Child1', id: 'child1', url: 'section/child1' },
                    { text: 'Child2', id: 'child2', url: 'section/child2' },
                ],
            },
        ],
    };
    server.listen({ onUnhandledRequest: 'bypass' });
});
beforeEach(() => {
    config.featureToggles.publicDashboards = true;
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(true);
});
afterAll(() => {
    config.bootData = originalBootData;
    server.close();
});
afterEach(() => {
    jest.restoreAllMocks();
    server.resetHandlers();
});
const getNonExistentPublicDashboardResponse = () => rest.get('/api/dashboards/uid/:dashboardUid/public-dashboards', (req, res, ctx) => {
    return res(ctx.status(404), ctx.json({
        message: 'Public dashboard not found',
        messageId: 'publicdashboards.notFound',
        statusCode: 404,
        traceID: '',
    }));
});
const getErrorPublicDashboardResponse = () => rest.get('/api/dashboards/uid/:dashboardUid/public-dashboards', (req, res, ctx) => {
    return res(ctx.status(500));
});
const alertTests = () => {
    it('when user has no write permissions, warning is shown', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
        yield renderSharePublicDashboard();
        expect(screen.queryByTestId(selectors.NoUpsertPermissionsWarningAlert)).toBeInTheDocument();
    }));
    it('when dashboard has template variables, warning is shown', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(sharePublicDashboardUtils, 'dashboardHasTemplateVariables').mockReturnValue(true);
        yield renderSharePublicDashboard();
        expect(screen.queryByTestId(selectors.TemplateVariablesWarningAlert)).toBeInTheDocument();
    }));
    it('when dashboard has unsupported datasources, warning is shown', () => __awaiter(void 0, void 0, void 0, function* () {
        const panelModel = {
            targets: [
                {
                    datasource: { type: 'notSupportedDatasource', uid: 'abc123' },
                },
            ],
        };
        const dashboard = createDashboardModelFixture({
            id: 1,
            panels: [panelModel],
        });
        yield renderSharePublicDashboard({ dashboard });
        expect(screen.queryByTestId(selectors.UnsupportedDataSourcesWarningAlert)).toBeInTheDocument();
    }));
};
describe('SharePublic', () => {
    beforeEach(() => {
        server.use(getExistentPublicDashboardResponse());
    });
    it('does not render share panel when public dashboards feature is disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        config.featureToggles.publicDashboards = false;
        yield renderSharePublicDashboard(undefined, false);
        expect(screen.getByRole('tablist')).toHaveTextContent('Link');
        expect(screen.getByRole('tablist')).not.toHaveTextContent('Public dashboard');
    }));
    it('renders default relative time in settings summary when they are closed', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(mockDashboard.time).toEqual({ from: 'now-6h', to: 'now' });
        //@ts-ignore
        mockDashboard.originalTime = { from: 'now-6h', to: 'now' };
        yield renderSharePublicDashboard();
        yield waitFor(() => screen.getByText('Time range ='));
        expect(screen.getByText('Last 6 hours')).toBeInTheDocument();
    }));
    it('renders default relative time in settings when they are open', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(mockDashboard.time).toEqual({ from: 'now-6h', to: 'now' });
        //@ts-ignore
        mockDashboard.originalTime = { from: 'now-6h', to: 'now' };
        yield renderSharePublicDashboard();
        yield userEvent.click(screen.getByText('Settings'));
        expect(screen.queryAllByText('Last 6 hours')).toHaveLength(2);
    }));
    it('when modal is opened, then checkboxes are enabled but create button is disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        server.use(getNonExistentPublicDashboardResponse());
        yield renderSharePublicDashboard();
        expect(screen.getByTestId(selectors.WillBePublicCheckbox)).toBeEnabled();
        expect(screen.getByTestId(selectors.LimitedDSCheckbox)).toBeEnabled();
        expect(screen.getByTestId(selectors.CostIncreaseCheckbox)).toBeEnabled();
        expect(screen.getByTestId(selectors.CreateButton)).toBeDisabled();
        expect(screen.queryByTestId(selectors.DeleteButton)).not.toBeInTheDocument();
    }));
    it('when fetch errors happen, then all inputs remain disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        server.use(getErrorPublicDashboardResponse());
        yield renderSharePublicDashboard();
        expect(screen.getByTestId(selectors.WillBePublicCheckbox)).toBeDisabled();
        expect(screen.getByTestId(selectors.LimitedDSCheckbox)).toBeDisabled();
        expect(screen.getByTestId(selectors.CostIncreaseCheckbox)).toBeDisabled();
        expect(screen.getByTestId(selectors.CreateButton)).toBeDisabled();
        expect(screen.queryByTestId(selectors.DeleteButton)).not.toBeInTheDocument();
    }));
});
describe('SharePublic - New config setup', () => {
    beforeEach(() => {
        server.use(getNonExistentPublicDashboardResponse());
    });
    it('renders when public dashboards feature is enabled', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderSharePublicDashboard();
        yield screen.findByText('Welcome to public dashboards!');
        expect(screen.getByText('Generate public URL')).toBeInTheDocument();
        expect(screen.queryByTestId(selectors.WillBePublicCheckbox)).toBeInTheDocument();
        expect(screen.queryByTestId(selectors.LimitedDSCheckbox)).toBeInTheDocument();
        expect(screen.queryByTestId(selectors.CostIncreaseCheckbox)).toBeInTheDocument();
        expect(screen.queryByTestId(selectors.CreateButton)).toBeInTheDocument();
        expect(screen.queryByTestId(selectors.DeleteButton)).not.toBeInTheDocument();
    }));
    it('when modal is opened, then create button is disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderSharePublicDashboard();
        expect(screen.getByTestId(selectors.CreateButton)).toBeDisabled();
    }));
    it('when checkboxes are filled, then create button is enabled', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderSharePublicDashboard();
        yield userEvent.click(screen.getByTestId(selectors.WillBePublicCheckbox));
        yield userEvent.click(screen.getByTestId(selectors.LimitedDSCheckbox));
        yield userEvent.click(screen.getByTestId(selectors.CostIncreaseCheckbox));
        expect(screen.getByTestId(selectors.CreateButton)).toBeEnabled();
    }));
    alertTests();
});
describe('SharePublic - Already persisted', () => {
    beforeEach(() => {
        server.use(getExistentPublicDashboardResponse());
    });
    it('when modal is opened, then delete button is enabled', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderSharePublicDashboard();
        yield waitFor(() => {
            expect(screen.getByTestId(selectors.DeleteButton)).toBeEnabled();
        });
    }));
    it('when fetch is done, then inputs are checked and delete button is enabled', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderSharePublicDashboard();
        yield userEvent.click(screen.getByText('Settings'));
        yield waitFor(() => {
            expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeEnabled();
        });
        expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeChecked();
        expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeEnabled();
        expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeChecked();
        expect(screen.getByTestId(selectors.PauseSwitch)).toBeEnabled();
        expect(screen.getByTestId(selectors.PauseSwitch)).not.toBeChecked();
        expect(screen.getByTestId(selectors.DeleteButton)).toBeEnabled();
    }));
    it('inputs and delete button are disabled because of lack of permissions', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
        yield renderSharePublicDashboard();
        yield userEvent.click(screen.getByText('Settings'));
        expect(yield screen.findByTestId(selectors.EnableTimeRangeSwitch)).toBeDisabled();
        expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeChecked();
        expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeDisabled();
        expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeChecked();
        expect(screen.getByTestId(selectors.PauseSwitch)).toBeDisabled();
        expect(screen.getByTestId(selectors.PauseSwitch)).not.toBeChecked();
        expect(screen.queryByTestId(selectors.DeleteButton)).toBeDisabled();
    }));
    it('when modal is opened, then time range switch is enabled and not checked when its not checked in the db', () => __awaiter(void 0, void 0, void 0, function* () {
        server.use(rest.get('/api/dashboards/uid/:dashboardUid/public-dashboards', (req, res, ctx) => {
            return res(ctx.status(200), ctx.json(Object.assign(Object.assign({}, pubdashResponse), { timeSelectionEnabled: false })));
        }));
        yield renderSharePublicDashboard();
        yield userEvent.click(screen.getByText('Settings'));
        const enableTimeRangeSwitch = yield screen.findByTestId(selectors.EnableTimeRangeSwitch);
        yield waitFor(() => {
            expect(enableTimeRangeSwitch).toBeEnabled();
            expect(enableTimeRangeSwitch).not.toBeChecked();
        });
    }));
    it('when pubdash is enabled, then link url is available', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderSharePublicDashboard();
        expect(screen.getByTestId(selectors.CopyUrlInput)).toBeInTheDocument();
    }));
    it('when pubdash is disabled in the db, then link url is not copyable and switch is checked', () => __awaiter(void 0, void 0, void 0, function* () {
        server.use(rest.get('/api/dashboards/uid/:dashboardUid/public-dashboards', (req, res, ctx) => {
            return res(ctx.status(200), ctx.json({
                isEnabled: false,
                annotationsEnabled: false,
                uid: 'a-uid',
                dashboardUid: req.params.dashboardUid,
                accessToken: 'an-access-token',
            }));
        }));
        yield renderSharePublicDashboard();
        expect(yield screen.findByTestId(selectors.CopyUrlInput)).toBeInTheDocument();
        expect(screen.queryByTestId(selectors.CopyUrlButton)).not.toBeChecked();
        expect(screen.getByTestId(selectors.PauseSwitch)).toBeChecked();
    }));
    it('does not render email sharing section', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderSharePublicDashboard();
        expect(screen.queryByTestId(selectors.EmailSharingConfiguration.EmailSharingInput)).not.toBeInTheDocument();
        expect(screen.queryByTestId(selectors.EmailSharingConfiguration.EmailSharingInviteButton)).not.toBeInTheDocument();
        expect(screen.queryByTestId(selectors.EmailSharingConfiguration.EmailSharingList)).not.toBeInTheDocument();
    }));
    alertTests();
});
describe('SharePublic - Report interactions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        server.use(getExistentPublicDashboardResponse());
        server.use(rest.patch('/api/dashboards/uid/:dashboardUid/public-dashboards/:uid', (req, res, ctx) => res(ctx.status(200), ctx.json(Object.assign(Object.assign({}, pubdashResponse), { dashboardUid: req.params.dashboardUid })))));
    });
    it('reports interaction when public dashboard tab is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderSharePublicDashboard();
        yield waitFor(() => {
            expect(trackDashboardSharingTypeOpen).toHaveBeenCalledTimes(1);
            expect(trackDashboardSharingTypeOpen).lastCalledWith(shareDashboardType.publicDashboard);
        });
    }));
    it('reports interaction when time range is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderSharePublicDashboard();
        yield userEvent.click(screen.getByText('Settings'));
        yield waitFor(() => {
            expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeEnabled();
        });
        yield userEvent.click(screen.getByTestId(selectors.EnableTimeRangeSwitch));
        yield waitFor(() => {
            expect(trackDashboardSharingActionPerType).toHaveBeenCalledTimes(1);
            // if time range was enabled, then the item is now disable_time
            expect(trackDashboardSharingActionPerType).toHaveBeenLastCalledWith(pubdashResponse.timeSelectionEnabled ? 'disable_time' : 'enable_time', shareDashboardType.publicDashboard);
        });
    }));
    it('reports interaction when show annotations is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderSharePublicDashboard();
        yield userEvent.click(screen.getByText('Settings'));
        yield waitFor(() => {
            expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeEnabled();
        });
        yield userEvent.click(screen.getByTestId(selectors.EnableAnnotationsSwitch));
        yield waitFor(() => {
            expect(trackDashboardSharingActionPerType).toHaveBeenCalledTimes(1);
            // if annotations was enabled, then the item is now disable_annotations
            expect(trackDashboardSharingActionPerType).toHaveBeenCalledWith(pubdashResponse.annotationsEnabled ? 'disable_annotations' : 'enable_annotations', shareDashboardType.publicDashboard);
        });
    }));
    it('reports interaction when pause is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderSharePublicDashboard();
        yield waitFor(() => {
            expect(screen.getByTestId(selectors.PauseSwitch)).toBeEnabled();
        });
        yield userEvent.click(screen.getByTestId(selectors.PauseSwitch));
        yield waitFor(() => {
            expect(trackDashboardSharingActionPerType).toHaveBeenCalledTimes(1);
            // if sharing was enabled, then the item is now disable_sharing
            expect(trackDashboardSharingActionPerType).toHaveBeenLastCalledWith(pubdashResponse.isEnabled ? 'disable_sharing' : 'enable_sharing', shareDashboardType.publicDashboard);
        });
    }));
});
//# sourceMappingURL=SharePublicDashboard.test.js.map