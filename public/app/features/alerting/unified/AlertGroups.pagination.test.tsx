import { HttpResponse, http } from 'msw';
import { render, waitFor, waitForElementToBeRemoved } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { type AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import AlertGroups from './AlertGroups';
import { setupMswServer } from './mockApi';
import { grantUserPermissions, mockAlertGroup, mockAlertmanagerAlert, mockDataSource } from './mocks';
import { AlertmanagerProvider } from './state/AlertmanagerContext';
import { DataSourceType } from './utils/datasource';

jest.mock('./utils/constants', () => ({
  ...jest.requireActual('./utils/constants'),
  GROUPS_PER_PAGE: 2,
}));

const server = setupMswServer();

const dataSources = {
  am: mockDataSource({
    name: 'Alertmanager',
    type: DataSourceType.Alertmanager,
  }),
};

function mockAlertGroupsResponse(groups: AlertmanagerGroup[]) {
  server.use(http.get('/api/alertmanager/:datasourceUid/api/v2/alerts/groups', () => HttpResponse.json(groups)));
}

const renderAmNotifications = () => {
  return render(
    <AlertmanagerProvider accessType={'instance'}>
      <AlertGroups />
    </AlertmanagerProvider>
  );
};

const ui = {
  group: byTestId('alert-group'),
  groupByContainer: byTestId('group-by-container'),
  groupByInput: byRole('combobox', { name: /group by label keys/i }),
  loadingIndicator: byText('Loading notifications'),
  nextPageButton: byRole('button', { name: /next page/i }),
  previousPageButton: byRole('button', { name: /previous page/i }),
};

describe('AlertGroups pagination', () => {
  beforeAll(() => {
    grantUserPermissions([
      AccessControlAction.AlertingInstanceRead,
      AccessControlAction.AlertingInstanceCreate,
      AccessControlAction.AlertingInstancesExternalRead,
      AccessControlAction.AlertingRuleRead,
    ]);
  });

  beforeEach(() => {
    setupDataSources(dataSources.am);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('should not render pagination when groups fit on one page', async () => {
    const groups = Array.from({ length: 2 }, (_, i) =>
      mockAlertGroup({
        labels: { index: String(i) },
        alerts: [mockAlertmanagerAlert({ labels: { index: String(i) } })],
      })
    );
    mockAlertGroupsResponse(groups);

    renderAmNotifications();
    await waitForElementToBeRemoved(ui.loadingIndicator.query());

    const alertGroups = await ui.group.findAll();
    expect(alertGroups).toHaveLength(2);
    expect(ui.nextPageButton.query()).not.toBeInTheDocument();
  });

  it('should render pagination when groups exceed the page size', async () => {
    const groups = Array.from({ length: 3 }, (_, i) =>
      mockAlertGroup({
        labels: { index: String(i) },
        alerts: [mockAlertmanagerAlert({ labels: { index: String(i) } })],
      })
    );
    mockAlertGroupsResponse(groups);

    renderAmNotifications();
    await waitForElementToBeRemoved(ui.loadingIndicator.query());

    const alertGroups = await ui.group.findAll();
    expect(alertGroups).toHaveLength(2);
    expect(ui.nextPageButton.get()).toBeInTheDocument();
  });

  it('should navigate between pages using pagination controls', async () => {
    const groups = Array.from({ length: 5 }, (_, i) =>
      mockAlertGroup({
        labels: { index: String(i) },
        alerts: [mockAlertmanagerAlert({ labels: { index: String(i) } })],
      })
    );
    mockAlertGroupsResponse(groups);

    const { user } = renderAmNotifications();
    await waitForElementToBeRemoved(ui.loadingIndicator.query());

    let alertGroups = await ui.group.findAll();
    expect(alertGroups).toHaveLength(2);
    expect(alertGroups[0]).toHaveTextContent('index0');

    await user.click(ui.nextPageButton.get());

    alertGroups = await ui.group.findAll();
    expect(alertGroups).toHaveLength(2);
    expect(alertGroups[0]).toHaveTextContent('index2');

    await user.click(ui.nextPageButton.get());

    alertGroups = await ui.group.findAll();
    expect(alertGroups).toHaveLength(1);
    expect(alertGroups[0]).toHaveTextContent('index4');

    await user.click(ui.previousPageButton.get());

    alertGroups = await ui.group.findAll();
    expect(alertGroups).toHaveLength(2);
    expect(alertGroups[0]).toHaveTextContent('index2');
  });

  it('should reset to page 1 when filters change the number of pages', async () => {
    const groups = Array.from({ length: 5 }, (_, i) =>
      mockAlertGroup({
        labels: { index: String(i), region: 'US' },
        alerts: [mockAlertmanagerAlert({ labels: { index: String(i), region: 'US' } })],
      })
    );
    mockAlertGroupsResponse(groups);

    const { user } = renderAmNotifications();
    await waitForElementToBeRemoved(ui.loadingIndicator.query());

    await user.click(ui.nextPageButton.get());

    let alertGroups = await ui.group.findAll();
    expect(alertGroups[0]).toHaveTextContent('index2');

    await user.type(ui.groupByInput.get(), 'region{enter}');
    await waitFor(() => expect(ui.groupByContainer.get()).toHaveTextContent('region'));

    alertGroups = await ui.group.findAll();
    expect(alertGroups).toHaveLength(1);
    expect(alertGroups[0]).toHaveTextContent('regionUS');
    expect(ui.nextPageButton.query()).not.toBeInTheDocument();
  });
});
