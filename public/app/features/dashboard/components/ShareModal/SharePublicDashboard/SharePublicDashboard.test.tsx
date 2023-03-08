import { fireEvent, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

import 'whatwg-fetch';
import { BootData, DataQuery } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { setEchoSrv } from '@grafana/runtime/src';
import { Panel } from '@grafana/schema';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';

import * as sharePublicDashboardUtils from './SharePublicDashboardUtils';
import {
  getExistentPublicDashboardResponse,
  mockDashboard,
  pubdashResponse,
  renderSharePublicDashboard,
} from './utilsTest';

const server = setupServer();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

let originalBootData: BootData;

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
  } as BootData;

  server.listen({ onUnhandledRequest: 'bypass' });
});

beforeEach(() => {
  config.featureToggles.publicDashboards = true;

  jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);
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

const getNonExistentPublicDashboardResponse = () =>
  rest.get('/api/dashboards/uid/:dashboardUid/public-dashboards', (req, res, ctx) => {
    return res(
      ctx.status(404),
      ctx.json({
        message: 'Public dashboard not found',
        messageId: 'publicdashboards.notFound',
        statusCode: 404,
        traceID: '',
      })
    );
  });
const getErrorPublicDashboardResponse = () =>
  rest.get('/api/dashboards/uid/:dashboardUid/public-dashboards', (req, res, ctx) => {
    return res(ctx.status(500));
  });

const alertTests = () => {
  it('when user has no write permissions, warning is shown', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(false);

    await renderSharePublicDashboard();
    expect(screen.queryByTestId(selectors.NoUpsertPermissionsWarningAlert)).toBeInTheDocument();
  });
  it('when dashboard has template variables, warning is shown', async () => {
    jest.spyOn(sharePublicDashboardUtils, 'dashboardHasTemplateVariables').mockReturnValue(true);

    await renderSharePublicDashboard();
    expect(screen.queryByTestId(selectors.TemplateVariablesWarningAlert)).toBeInTheDocument();
  });
  it('when dashboard has unsupported datasources, warning is shown', async () => {
    const panelModel = {
      targets: [
        {
          datasource: { type: 'notSupportedDatasource', uid: 'abc123' },
        } as DataQuery,
      ] as DataQuery[],
    } as unknown as Panel;
    const dashboard = createDashboardModelFixture({
      id: 1,
      panels: [panelModel],
    });

    await renderSharePublicDashboard({ dashboard });
    expect(screen.queryByTestId(selectors.UnsupportedDataSourcesWarningAlert)).toBeInTheDocument();
  });
};

describe('SharePublic', () => {
  beforeEach(() => {
    server.use(getExistentPublicDashboardResponse());
  });
  it('does not render share panel when public dashboards feature is disabled', async () => {
    config.featureToggles.publicDashboards = false;
    await renderSharePublicDashboard(undefined, false);

    expect(screen.getByRole('tablist')).toHaveTextContent('Link');
    expect(screen.getByRole('tablist')).not.toHaveTextContent('Public dashboard');
  });
  it('renders default relative time in input', async () => {
    expect(mockDashboard.time).toEqual({ from: 'now-6h', to: 'now' });

    //@ts-ignore
    mockDashboard.originalTime = { from: 'now-6h', to: 'now' };

    await renderSharePublicDashboard();
    expect(screen.getByText('Last 6 hours')).toBeInTheDocument();
  });
  it('renders default absolute time in input 2', async () => {
    mockDashboard.time = { from: '2022-08-30T03:00:00.000Z', to: '2022-09-04T02:59:59.000Z' };
    //@ts-ignore
    mockDashboard.originalTime = { from: '2022-08-30T06:00:00.000Z', to: '2022-09-04T06:59:59.000Z' };

    await renderSharePublicDashboard();
    expect(screen.getByText('2022-08-30 00:00:00 to 2022-09-04 00:59:59')).toBeInTheDocument();
  });
  it('when modal is opened, then checkboxes are enabled but create button is disabled', async () => {
    server.use(getNonExistentPublicDashboardResponse());
    await renderSharePublicDashboard();

    expect(screen.getByTestId(selectors.WillBePublicCheckbox)).toBeEnabled();
    expect(screen.getByTestId(selectors.LimitedDSCheckbox)).toBeEnabled();
    expect(screen.getByTestId(selectors.CostIncreaseCheckbox)).toBeEnabled();
    expect(screen.getByTestId(selectors.CreateButton)).toBeDisabled();
    expect(screen.queryByTestId(selectors.DeleteButton)).not.toBeInTheDocument();
  });
  it('when fetch errors happen, then all inputs remain disabled', async () => {
    server.use(getErrorPublicDashboardResponse());

    await renderSharePublicDashboard();

    expect(screen.getByTestId(selectors.WillBePublicCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.LimitedDSCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.CostIncreaseCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.CreateButton)).toBeDisabled();
    expect(screen.queryByTestId(selectors.DeleteButton)).not.toBeInTheDocument();
  });
});

describe('SharePublic - New config setup', () => {
  beforeEach(() => {
    server.use(getNonExistentPublicDashboardResponse());
  });

  it('renders when public dashboards feature is enabled', async () => {
    await renderSharePublicDashboard();

    await screen.findByText('Welcome to public dashboards alpha!');
    expect(screen.getByText('Generate public URL')).toBeInTheDocument();

    expect(screen.queryByTestId(selectors.WillBePublicCheckbox)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.LimitedDSCheckbox)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.CostIncreaseCheckbox)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.CreateButton)).toBeInTheDocument();

    expect(screen.queryByTestId(selectors.DeleteButton)).not.toBeInTheDocument();
  });
  it('when modal is opened, then create button is disabled', async () => {
    await renderSharePublicDashboard();
    expect(screen.getByTestId(selectors.CreateButton)).toBeDisabled();
  });
  it('when checkboxes are filled, then create button is enabled', async () => {
    await renderSharePublicDashboard();

    fireEvent.click(screen.getByTestId(selectors.WillBePublicCheckbox));
    fireEvent.click(screen.getByTestId(selectors.LimitedDSCheckbox));
    fireEvent.click(screen.getByTestId(selectors.CostIncreaseCheckbox));

    await waitFor(() => expect(screen.getByTestId(selectors.CreateButton)).toBeEnabled());
  });
  alertTests();
});

describe('SharePublic - Already persisted', () => {
  beforeEach(() => {
    server.use(getExistentPublicDashboardResponse());
  });

  it('when modal is opened, then delete button is enabled', async () => {
    await renderSharePublicDashboard();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));
    expect(screen.getByTestId(selectors.DeleteButton)).toBeEnabled();
  });
  it('when fetch is done, then inputs are checked and delete button is enabled', async () => {
    await renderSharePublicDashboard();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

    expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeEnabled();
    expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeChecked();

    expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeEnabled();
    expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeChecked();

    expect(screen.getByTestId(selectors.PauseSwitch)).toBeEnabled();
    expect(screen.getByTestId(selectors.PauseSwitch)).not.toBeChecked();

    expect(screen.getByTestId(selectors.DeleteButton)).toBeEnabled();
  });
  it('inputs and delete button are disabled because of lack of permissions', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(false);
    await renderSharePublicDashboard();

    expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeDisabled();
    expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeChecked();

    expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeDisabled();
    expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeChecked();

    expect(screen.getByTestId(selectors.PauseSwitch)).toBeDisabled();
    expect(screen.getByTestId(selectors.PauseSwitch)).not.toBeChecked();

    expect(screen.queryByTestId(selectors.DeleteButton)).toBeDisabled();
  });
  it('when modal is opened, then time range switch is enabled and not checked when its not checked in the db', async () => {
    server.use(
      rest.get('/api/dashboards/uid/:dashboardUid/public-dashboards', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            ...pubdashResponse,
            timeSelectionEnabled: false,
          })
        );
      })
    );

    await renderSharePublicDashboard();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

    const enableTimeRangeSwitch = screen.getByTestId(selectors.EnableTimeRangeSwitch);
    expect(enableTimeRangeSwitch).toBeEnabled();
    expect(enableTimeRangeSwitch).not.toBeChecked();
  });
  it('when pubdash is enabled, then link url is available', async () => {
    await renderSharePublicDashboard();
    expect(screen.getByTestId(selectors.CopyUrlInput)).toBeInTheDocument();
  });
  it('when pubdash is disabled in the db, then link url is not copyable and switch is checked', async () => {
    server.use(
      rest.get('/api/dashboards/uid/:dashboardUid/public-dashboards', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            isEnabled: false,
            annotationsEnabled: false,
            uid: 'a-uid',
            dashboardUid: req.params.dashboardUid,
            accessToken: 'an-access-token',
          })
        );
      })
    );

    await renderSharePublicDashboard();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

    expect(screen.queryByTestId(selectors.CopyUrlInput)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.CopyUrlButton)).not.toBeChecked();

    expect(screen.getByTestId(selectors.PauseSwitch)).toBeChecked();
  });
  it('does not render email sharing section', async () => {
    await renderSharePublicDashboard();

    expect(screen.queryByTestId(selectors.EmailSharingConfiguration.EmailSharingInput)).not.toBeInTheDocument();
    expect(screen.queryByTestId(selectors.EmailSharingConfiguration.EmailSharingInviteButton)).not.toBeInTheDocument();
    expect(screen.queryByTestId(selectors.EmailSharingConfiguration.EmailSharingList)).not.toBeInTheDocument();
  });
  alertTests();
});
