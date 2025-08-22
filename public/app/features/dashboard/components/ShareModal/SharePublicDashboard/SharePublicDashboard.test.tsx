import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { BootData, DataQuery } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction, setEchoSrv } from '@grafana/runtime';
import { Panel } from '@grafana/schema';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { shareDashboardType } from '../utils';

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
  reportInteraction: jest.fn(),
}));

jest.mock('app/features/dashboard-scene/utils/interactions', () => ({
  DashboardInteractions: {
    ...jest.requireActual('app/features/dashboard-scene/utils/interactions').DashboardInteractions,
    sharingTabChanged: jest.fn(),
  },
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
  config.publicDashboardsEnabled = true;

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
  http.get('/api/dashboards/uid/:dashboardUid/public-dashboards', () => {
    return HttpResponse.json(
      {
        message: 'Public dashboard not found',
        messageId: 'publicdashboards.notFound',
        statusCode: 404,
        traceID: '',
      },
      {
        status: 404,
      }
    );
  });
const getErrorPublicDashboardResponse = () =>
  http.get('/api/dashboards/uid/:dashboardUid/public-dashboards', () => {
    return HttpResponse.json(
      {},
      {
        status: 500,
      }
    );
  });

const alertTests = () => {
  it('when user has no write permissions, warning is shown', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

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
    expect(await screen.findByTestId(selectors.UnsupportedDataSourcesWarningAlert)).toBeInTheDocument();
  });
};

describe('SharePublic', () => {
  beforeEach(() => {
    server.use(getExistentPublicDashboardResponse());
  });
  it('does not render share panel when public dashboards feature is disabled using config setting', async () => {
    config.publicDashboardsEnabled = false;
    await renderSharePublicDashboard(undefined, false);

    expect(screen.getByRole('tablist')).toHaveTextContent('Link');
    expect(screen.getByRole('tablist')).not.toHaveTextContent('Public dashboard');
  });
  it('renders default relative time in settings summary when they are closed', async () => {
    expect(mockDashboard.time).toEqual({ from: 'now-6h', to: 'now' });

    //@ts-ignore
    mockDashboard.originalTime = { from: 'now-6h', to: 'now' };

    await renderSharePublicDashboard();
    await waitFor(() => screen.getByText('Time range ='));

    expect(screen.getByText('Last 6 hours')).toBeInTheDocument();
  });
  it('renders default relative time in settings when they are open', async () => {
    expect(mockDashboard.time).toEqual({ from: 'now-6h', to: 'now' });

    //@ts-ignore
    mockDashboard.originalTime = { from: 'now-6h', to: 'now' };

    await renderSharePublicDashboard();
    await userEvent.click(screen.getByText('Settings'));

    expect(screen.queryAllByText('Last 6 hours')).toHaveLength(2);
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

    await screen.findByText('Welcome to public dashboards!');
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

    await userEvent.click(screen.getByTestId(selectors.WillBePublicCheckbox));
    await userEvent.click(screen.getByTestId(selectors.LimitedDSCheckbox));
    await userEvent.click(screen.getByTestId(selectors.CostIncreaseCheckbox));

    expect(screen.getByTestId(selectors.CreateButton)).toBeEnabled();
  });
  alertTests();
});

describe('SharePublic - Already persisted', () => {
  beforeEach(() => {
    server.use(getExistentPublicDashboardResponse());
  });

  it('when modal is opened, then delete button is enabled', async () => {
    await renderSharePublicDashboard();
    await waitFor(() => {
      expect(screen.getByTestId(selectors.DeleteButton)).toBeEnabled();
    });
  });
  it('when fetch is done, then inputs are checked and delete button is enabled', async () => {
    await renderSharePublicDashboard();
    await userEvent.click(screen.getByText('Settings'));

    await waitFor(() => {
      expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeEnabled();
    });
    expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeChecked();

    expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeEnabled();
    expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeChecked();

    expect(screen.getByTestId(selectors.PauseSwitch)).toBeEnabled();
    expect(screen.getByTestId(selectors.PauseSwitch)).not.toBeChecked();

    expect(screen.getByTestId(selectors.DeleteButton)).toBeEnabled();
  });
  it('inputs and delete button are disabled because of lack of permissions', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    await renderSharePublicDashboard();
    await userEvent.click(screen.getByText('Settings'));

    expect(await screen.findByTestId(selectors.EnableTimeRangeSwitch)).toBeDisabled();
    expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeChecked();

    expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeDisabled();
    expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeChecked();

    expect(screen.getByTestId(selectors.PauseSwitch)).toBeDisabled();
    expect(screen.getByTestId(selectors.PauseSwitch)).not.toBeChecked();

    expect(screen.queryByTestId(selectors.DeleteButton)).toBeDisabled();
  });
  it('when modal is opened, then time range switch is enabled and not checked when its not checked in the db', async () => {
    server.use(
      http.get('/api/dashboards/uid/:dashboardUid/public-dashboards', () => {
        return HttpResponse.json({
          ...pubdashResponse,
          timeSelectionEnabled: false,
        });
      })
    );

    await renderSharePublicDashboard();
    await userEvent.click(screen.getByText('Settings'));

    const enableTimeRangeSwitch = await screen.findByTestId(selectors.EnableTimeRangeSwitch);
    await waitFor(() => {
      expect(enableTimeRangeSwitch).toBeEnabled();
      expect(enableTimeRangeSwitch).not.toBeChecked();
    });
  });
  it('when pubdash is enabled, then link url is available', async () => {
    await renderSharePublicDashboard();
    expect(screen.getByTestId(selectors.CopyUrlInput)).toBeInTheDocument();
  });
  it('when pubdash is disabled in the db, then link url is not copyable and switch is checked', async () => {
    server.use(
      http.get('/api/dashboards/uid/:dashboardUid/public-dashboards', ({ request }) => {
        const url = new URL(request.url);
        const dashboardUid = url.searchParams.get('dashboardUid');
        return HttpResponse.json({
          isEnabled: false,
          annotationsEnabled: false,
          uid: 'a-uid',
          dashboardUid,
          accessToken: 'an-access-token',
        });
      })
    );

    await renderSharePublicDashboard();

    expect(await screen.findByTestId(selectors.CopyUrlInput)).toBeInTheDocument();
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

describe('SharePublic - Report interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    server.use(getExistentPublicDashboardResponse());
    server.use(
      http.patch('/api/dashboards/uid/:dashboardUid/public-dashboards/:uid', ({ request }) => {
        const url = new URL(request.url);
        const dashboardUid = url.searchParams.get('dashboardUid');
        return HttpResponse.json({
          ...pubdashResponse,
          dashboardUid,
        });
      })
    );
  });

  it('reports interaction when public dashboard tab is clicked', async () => {
    jest.spyOn(DashboardInteractions, 'sharingCategoryClicked');
    await renderSharePublicDashboard();

    await waitFor(() => {
      expect(DashboardInteractions.sharingCategoryClicked).lastCalledWith({
        item: shareDashboardType.publicDashboard,
        shareResource: 'dashboard',
      });
    });
  });

  it('reports interaction when time range is clicked', async () => {
    await renderSharePublicDashboard();
    await userEvent.click(screen.getByText('Settings'));

    await waitFor(() => {
      expect(screen.getByTestId(selectors.EnableTimeRangeSwitch)).toBeEnabled();
    });
    await userEvent.click(screen.getByTestId(selectors.EnableTimeRangeSwitch));

    await waitFor(() => {
      expect(reportInteraction).toHaveBeenLastCalledWith('dashboards_sharing_public_time_picker_clicked', {
        enabled: !pubdashResponse.timeSelectionEnabled,
        isDynamicDashboard: false,
      });
    });
  });

  it('reports interaction when show annotations is clicked', async () => {
    await renderSharePublicDashboard();
    await userEvent.click(screen.getByText('Settings'));

    await waitFor(() => {
      expect(screen.getByTestId(selectors.EnableAnnotationsSwitch)).toBeEnabled();
    });
    await userEvent.click(screen.getByTestId(selectors.EnableAnnotationsSwitch));

    await waitFor(() => {
      expect(reportInteraction).toHaveBeenLastCalledWith('dashboards_sharing_public_annotations_clicked', {
        enabled: !pubdashResponse.annotationsEnabled,
        isDynamicDashboard: false,
      });
    });
  });
  it('reports interaction when pause is clicked', async () => {
    await renderSharePublicDashboard();
    await waitFor(() => {
      expect(screen.getByTestId(selectors.PauseSwitch)).toBeEnabled();
    });
    await userEvent.click(screen.getByTestId(selectors.PauseSwitch));

    await waitFor(() => {
      expect(reportInteraction).toHaveBeenLastCalledWith('dashboards_sharing_public_pause_clicked', {
        paused: pubdashResponse.isEnabled,
        isDynamicDashboard: false,
      });
    });
  });
});
