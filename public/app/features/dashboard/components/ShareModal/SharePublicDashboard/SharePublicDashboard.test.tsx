import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { Provider } from 'react-redux';

import 'whatwg-fetch';
import { BootData } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { setEchoSrv } from '@grafana/runtime/src';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { configureStore } from 'app/store/configureStore';

import { ShareModal } from '../ShareModal';

const server = setupServer(
  rest.get('/api/dashboards/uid/:uId/public-config', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        isEnabled: false,
        uid: undefined,
        dashboardUid: undefined,
        accessToken: 'an-access-token',
      })
    );
  })
);

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: () => backendSrv,
}));

const renderSharePublicDashboard = async (props: React.ComponentProps<typeof ShareModal>, isEnabled = true) => {
  const store = configureStore();

  render(
    <Provider store={store}>
      <ShareModal {...props} />
    </Provider>
  );

  await waitFor(() => screen.getByText('Link'));
  isEnabled && fireEvent.click(screen.getByText('Public dashboard'));
};

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

let originalBootData: BootData;
let mockDashboard: DashboardModel;
let mockPanel: PanelModel;

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
  } as any;

  server.listen({ onUnhandledRequest: 'bypass' });
});

beforeEach(() => {
  config.featureToggles.publicDashboards = true;
  mockDashboard = new DashboardModel({
    uid: 'mockDashboardUid',
  });

  mockPanel = new PanelModel({
    id: 'mockPanelId',
  });

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

describe('SharePublic', () => {
  it('does not render share panel when public dashboards feature is disabled', async () => {
    config.featureToggles.publicDashboards = false;
    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} }, false);

    expect(screen.getByRole('tablist')).toHaveTextContent('Link');
    expect(screen.getByRole('tablist')).not.toHaveTextContent('Public dashboard');
  });

  it('renders share panel when public dashboards feature is enabled', async () => {
    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });

    expect(screen.getByRole('tablist')).toHaveTextContent('Link');
    expect(screen.getByRole('tablist')).toHaveTextContent('Public dashboard');

    fireEvent.click(screen.getByText('Public dashboard'));

    await screen.findByText('Welcome to Grafana public dashboards alpha!');
  });

  it('renders default relative time in input', async () => {
    expect(mockDashboard.time).toEqual({ from: 'now-6h', to: 'now' });

    //@ts-ignore
    mockDashboard.originalTime = { from: 'now-6h', to: 'now' };

    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });

    await screen.findByText('Welcome to Grafana public dashboards alpha!');
    expect(screen.getByText('Last 6 hours')).toBeInTheDocument();
  });
  it('renders default absolute time in input 2', async () => {
    mockDashboard.time = { from: '2022-08-30T03:00:00.000Z', to: '2022-09-04T02:59:59.000Z' };
    //@ts-ignore
    mockDashboard.originalTime = { from: '2022-08-30T06:00:00.000Z', to: '2022-09-04T06:59:59.000Z' };

    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });

    await screen.findByText('Welcome to Grafana public dashboards alpha!');
    expect(screen.getByText('2022-08-30 00:00:00 to 2022-09-04 01:59:59')).toBeInTheDocument();
  });
  it('when modal is opened, then loader spinner appears and inputs are disabled', async () => {
    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });

    expect(await screen.findByTestId('Spinner')).toBeInTheDocument();

    expect(screen.getByTestId(selectors.WillBePublicCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.LimitedDSCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.CostIncreaseCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.EnableSwitch)).toBeDisabled();
    expect(screen.getByTestId(selectors.SaveConfigButton)).toBeDisabled();
  });
  it('when fetch errors happen, then all inputs remain disabled', async () => {
    server.use(
      rest.get('/api/dashboards/uid/:uId/public-config', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });
    await waitForElementToBeRemoved(screen.getByTestId('Spinner'), { timeout: 7000 });

    expect(screen.getByTestId(selectors.WillBePublicCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.LimitedDSCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.CostIncreaseCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.EnableSwitch)).toBeDisabled();
    expect(screen.getByTestId(selectors.SaveConfigButton)).toBeDisabled();
  });
  // test checking if current version of dashboard in state is persisted to db
});

describe('SharePublic - New config setup', () => {
  it('when modal is opened, then save button is disabled', async () => {
    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });
    expect(screen.getByTestId(selectors.SaveConfigButton)).toBeDisabled();
  });
  it('when fetch is done, then loader spinner is gone, inputs are enabled and save button is disabled', async () => {
    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });
    await waitForElementToBeRemoved(screen.getByTestId('Spinner'));

    expect(screen.getByTestId(selectors.WillBePublicCheckbox)).toBeEnabled();
    expect(screen.getByTestId(selectors.LimitedDSCheckbox)).toBeEnabled();
    expect(screen.getByTestId(selectors.CostIncreaseCheckbox)).toBeEnabled();
    expect(screen.getByTestId(selectors.EnableSwitch)).toBeEnabled();

    expect(screen.getByTestId(selectors.SaveConfigButton)).toBeDisabled();
  });
  it('when checkboxes are filled, then save button remains disabled', async () => {
    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });
    await waitForElementToBeRemoved(screen.getByTestId('Spinner'));

    fireEvent.click(screen.getByTestId(selectors.WillBePublicCheckbox));
    fireEvent.click(screen.getByTestId(selectors.LimitedDSCheckbox));
    fireEvent.click(screen.getByTestId(selectors.CostIncreaseCheckbox));

    expect(screen.getByTestId(selectors.SaveConfigButton)).toBeDisabled();
  });
  it('when checkboxes and switch are filled, then save button is enabled', async () => {
    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });
    await waitForElementToBeRemoved(screen.getByTestId('Spinner'));

    fireEvent.click(screen.getByTestId(selectors.WillBePublicCheckbox));
    fireEvent.click(screen.getByTestId(selectors.LimitedDSCheckbox));
    fireEvent.click(screen.getByTestId(selectors.CostIncreaseCheckbox));
    fireEvent.click(screen.getByTestId(selectors.EnableSwitch));

    expect(screen.getByTestId(selectors.SaveConfigButton)).toBeEnabled();
  });
});

describe('SharePublic - Already persisted', () => {
  beforeEach(() => {
    server.use(
      rest.get('/api/dashboards/uid/:uId/public-config', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            isEnabled: true,
            uid: 'a-uid',
            dashboardUid: req.params.uId,
            accessToken: 'an-access-token',
          })
        );
      })
    );
  });

  it('when modal is opened, then save button is enabled', async () => {
    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });
    await waitForElementToBeRemoved(screen.getByTestId('Spinner'));

    expect(screen.getByTestId(selectors.SaveConfigButton)).toBeEnabled();
  });
  it('when fetch is done, then loader spinner is gone, inputs are disabled and save button is enabled', async () => {
    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });
    await waitForElementToBeRemoved(screen.getByTestId('Spinner'));

    expect(screen.getByTestId(selectors.WillBePublicCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.LimitedDSCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.CostIncreaseCheckbox)).toBeDisabled();

    expect(screen.getByTestId(selectors.EnableSwitch)).toBeEnabled();
    expect(screen.getByTestId(selectors.SaveConfigButton)).toBeEnabled();
  });
  it('when pubdash is enabled, then link url is available', async () => {
    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });
    await waitForElementToBeRemoved(screen.getByTestId('Spinner'));
    expect(screen.getByTestId(selectors.CopyUrlInput)).toBeInTheDocument();
  });
  it('when pubdash is disabled in the db, then link url is not available', async () => {
    server.use(
      rest.get('/api/dashboards/uid/:uId/public-config', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            isEnabled: false,
            uid: 'a-uid',
            dashboardUid: req.params.uId,
            accessToken: 'an-access-token',
          })
        );
      })
    );

    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });
    await waitForElementToBeRemoved(screen.getByTestId('Spinner'));

    expect(screen.queryByTestId(selectors.CopyUrlInput)).not.toBeInTheDocument();
  });
  it('when pubdash is disabled by the user, then link url is not available', async () => {
    await renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });
    await waitForElementToBeRemoved(screen.getByTestId('Spinner'));

    fireEvent.click(screen.getByTestId(selectors.EnableSwitch));
    expect(screen.queryByTestId(selectors.CopyUrlInput)).not.toBeInTheDocument();
  });
});
