import { render, waitFor, waitForElementToBeRemoved } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { AccessControlAction } from 'app/types';

import AlertGroups from './AlertGroups';
import { fetchAlertGroups } from './api/alertmanager';
import { grantUserPermissions, mockAlertGroup, mockAlertmanagerAlert, mockDataSource } from './mocks';
import { AlertmanagerProvider } from './state/AlertmanagerContext';
import { DataSourceType } from './utils/datasource';

jest.mock('./api/alertmanager');
const mocks = {
  api: {
    fetchAlertGroups: jest.mocked(fetchAlertGroups),
  },
};

const renderAmNotifications = () => {
  return render(
    <AlertmanagerProvider accessType={'instance'}>
      <AlertGroups />
    </AlertmanagerProvider>
  );
};

const dataSources = {
  am: mockDataSource({
    name: 'Alertmanager',
    type: DataSourceType.Alertmanager,
  }),
};

const ui = {
  group: byTestId('alert-group'),
  groupCollapseToggle: byTestId('alert-group-collapse-toggle'),
  groupTable: byTestId('alert-group-table'),
  collapseToggle: byTestId(selectors.components.AlertRules.toggle),
  silenceButton: byText('Silence'),
  sourceButton: byText('See alert rule'),
  groupByContainer: byTestId('group-by-container'),
  groupByInput: byRole('combobox', { name: /group by label keys/i }),
  clearButton: byRole('button', { name: 'Clear filters' }),
  loadingIndicator: byText('Loading notifications'),
};

describe('AlertGroups', () => {
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
    mocks.api.fetchAlertGroups.mockClear();
  });

  it('loads and shows groups', async () => {
    mocks.api.fetchAlertGroups.mockImplementation(() => {
      return Promise.resolve([
        mockAlertGroup({ labels: {}, alerts: [mockAlertmanagerAlert({ labels: { foo: 'bar' } })] }),
        mockAlertGroup(),
      ]);
    });

    const { user } = renderAmNotifications();

    await waitFor(() => expect(mocks.api.fetchAlertGroups).toHaveBeenCalled());

    const groups = await ui.group.findAll();

    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('No grouping');
    const labels = byTestId('label-value').getAll();
    expect(labels[0]).toHaveTextContent('severitywarning');
    expect(labels[1]).toHaveTextContent('regionUS-Central');

    await user.click(ui.groupCollapseToggle.get(groups[0]));
    expect(ui.groupTable.get()).toBeDefined();

    await user.click(ui.collapseToggle.get(ui.groupTable.get()));
    expect(ui.silenceButton.get(ui.groupTable.get())).toBeDefined();
    expect(ui.sourceButton.get(ui.groupTable.get())).toBeDefined();
  });

  it('should group by custom grouping', async () => {
    const regions = ['NASA', 'EMEA', 'APAC'];
    mocks.api.fetchAlertGroups.mockImplementation(() => {
      const groups = regions.map((region) =>
        mockAlertGroup({
          labels: { region },
          alerts: [
            mockAlertmanagerAlert({ fingerprint: '1', labels: { region, appName: 'billing', env: 'production' } }),
            mockAlertmanagerAlert({
              fingerprint: '2',
              labels: { region, appName: 'auth', env: 'staging', uniqueLabel: 'true' },
            }),
            mockAlertmanagerAlert({ fingerprint: '3', labels: { region, appName: 'frontend', env: 'production' } }),
          ],
        })
      );
      return Promise.resolve(groups);
    });

    const { user } = renderAmNotifications();
    await waitFor(() => expect(mocks.api.fetchAlertGroups).toHaveBeenCalled());
    let groups = await ui.group.findAll();
    const groupByInput = ui.groupByInput.get();
    const groupByWrapper = ui.groupByContainer.get();

    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveTextContent('regionNASA');
    expect(groups[1]).toHaveTextContent('regionEMEA');
    expect(groups[2]).toHaveTextContent('regionAPAC');

    await user.type(groupByInput, 'appName{enter}');

    await waitFor(() => expect(groupByWrapper).toHaveTextContent('appName'));

    groups = await ui.group.findAll();

    await waitFor(() => expect(ui.clearButton.get()).toBeInTheDocument());
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveTextContent('appNamebilling');
    expect(groups[1]).toHaveTextContent('appNameauth');
    expect(groups[2]).toHaveTextContent('appNamefrontend');

    await user.click(ui.clearButton.get());
    await waitFor(() => expect(groupByWrapper).not.toHaveTextContent('appName'));

    await user.type(groupByInput, 'env{enter}');
    await waitFor(() => expect(groupByWrapper).toHaveTextContent('env'));

    groups = await ui.group.findAll();

    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('envproduction');
    expect(groups[1]).toHaveTextContent('envstaging');

    await user.click(ui.clearButton.get());
    await waitFor(() => expect(groupByWrapper).not.toHaveTextContent('env'));

    await user.type(groupByInput, 'uniqueLabel{enter}');
    await waitFor(() => expect(groupByWrapper).toHaveTextContent('uniqueLabel'));

    groups = await ui.group.findAll();
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('No grouping');
    expect(groups[1]).toHaveTextContent('uniqueLabeltrue');
  });

  it('should split custom grouping groups with the same label by receiver', async () => {
    // The same alert is repeated in two groups with different receivers
    const alert = mockAlertmanagerAlert({
      fingerprint: '1',
      labels: { region: 'NASA', appName: 'billing' },
      receivers: [{ name: 'slack' }, { name: 'email' }],
    });
    const amGroups = [
      mockAlertGroup({ receiver: { name: 'slack' }, labels: { region: 'NASA' }, alerts: [alert] }),
      mockAlertGroup({ receiver: { name: 'email' }, labels: { region: 'NASA' }, alerts: [alert] }),
    ];
    mocks.api.fetchAlertGroups.mockResolvedValue(amGroups);

    const { user } = renderAmNotifications();
    await waitForElementToBeRemoved(ui.loadingIndicator.query());

    // reset the input of the MultiSelect component
    await user.type(ui.groupByInput.get(), '{backspace}');
    await user.type(ui.groupByInput.get(), 'appName{enter}');

    const groups = await ui.group.findAll();

    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('appNamebillingDelivered to slack');
    expect(groups[1]).toHaveTextContent('appNamebillingDelivered to email');
  });

  it('should combine multiple ungrouped groups', async () => {
    mocks.api.fetchAlertGroups.mockImplementation(() => {
      const groups = [
        mockAlertGroup({ labels: {} }),
        mockAlertGroup({ labels: {}, alerts: [mockAlertmanagerAlert({ labels: { foo: 'bar' } })] }),
      ];
      return Promise.resolve(groups);
    });
    renderAmNotifications();
    await waitFor(() => {
      expect(ui.group.getAll()).toHaveLength(1);
    });
  });
});
