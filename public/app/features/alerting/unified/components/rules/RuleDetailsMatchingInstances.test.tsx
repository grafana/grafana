import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { times } from 'lodash';
import { render as renderWithProviders } from 'test/test-utils';
import { byLabelText, byRole, byTestId } from 'testing-library-selector';

import { PluginExtensionTypes } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { type Alert, type CombinedRuleNamespace } from '../../../../../types/unified-alerting';
import { GrafanaAlertState, PromAlertingRuleState } from '../../../../../types/unified-alerting-dto';
import { setupMswServer } from '../../mockApi';
import {
  grantUserPermissions,
  mockCombinedRule,
  mockDataSource,
  mockGrafanaPromAlertingRule,
  mockGrafanaRulerRule,
  mockPromAlert,
  mockPromAlertingRule,
} from '../../mocks';
import { setFolderAccessControl } from '../../mocks/server/configure';
import { alertStateToReadable } from '../../utils/rules';

import { RuleDetailsMatchingInstances } from './RuleDetailsMatchingInstances';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginLinkExtensions: jest.fn(),
  usePluginLinks: jest.fn(),
}));

jest.mock('../../useRouteGroupsMatcher');

setupMswServer();

const mocks = {
  usePluginLinksMock: jest.mocked(usePluginLinks),
};

const ui = {
  stateFilter: byTestId('alert-instance-state-filter'),
  stateButton: byRole('radio'),
  grafanaStateButton: {
    normal: byLabelText(/^Normal/),
    alerting: byLabelText(/^Alerting/),
    pending: byLabelText(/^Pending/),
    recovering: byLabelText(/^Recovering/),
    noData: byLabelText(/^NoData/),
    error: byLabelText(/^Error/),
  },
  cloudStateButton: {
    firing: byLabelText(/^Firing/),
    pending: byLabelText(/^Pending/),
  },
  instanceRow: byTestId('row'),
  showAllInstances: byTestId('show-all'),
};

describe('RuleDetailsMatchingInstances', () => {
  beforeEach(() => {
    mocks.usePluginLinksMock.mockReturnValue({
      links: [
        {
          pluginId: 'grafana-ml-app',
          id: '1',
          type: PluginExtensionTypes.link,
          title: 'Run investigation',
          category: 'Sift',
          description: 'Run a Sift investigation for this alert',
          onClick: jest.fn(),
        },
      ],
      isLoading: false,
    });
  });

  describe('Filtering', () => {
    it('For Grafana Managed rules instances filter should contain six states', () => {
      const rule = mockCombinedRule();

      render(<RuleDetailsMatchingInstances rule={rule} enableFiltering />);

      const stateFilter = ui.stateFilter.get();
      expect(stateFilter).toBeInTheDocument();

      const stateButtons = ui.stateButton.getAll(stateFilter);

      expect(stateButtons).toHaveLength(6);

      expect(ui.grafanaStateButton.normal.get(stateFilter)).toBeInTheDocument();
      expect(ui.grafanaStateButton.alerting.get(stateFilter)).toBeInTheDocument();
      expect(ui.grafanaStateButton.pending.get(stateFilter)).toBeInTheDocument();
      expect(ui.grafanaStateButton.noData.get(stateFilter)).toBeInTheDocument();
      expect(ui.grafanaStateButton.error.get(stateFilter)).toBeInTheDocument();
    });

    it.each(Object.values(GrafanaAlertState))('Should filter grafana rules by %s state', async (state) => {
      const rule = mockCombinedRule({
        promRule: mockPromAlertingRule({
          alerts: [
            mockPromAlert({ state: GrafanaAlertState.Normal }),
            mockPromAlert({ state: GrafanaAlertState.Alerting }),
            mockPromAlert({ state: GrafanaAlertState.Pending }),
            mockPromAlert({ state: GrafanaAlertState.Recovering }),
            mockPromAlert({ state: GrafanaAlertState.NoData }),
            mockPromAlert({ state: GrafanaAlertState.Error }),
          ],
        }),
      });

      const buttons = {
        [GrafanaAlertState.Normal]: ui.grafanaStateButton.normal,
        [GrafanaAlertState.Alerting]: ui.grafanaStateButton.alerting,
        [GrafanaAlertState.Pending]: ui.grafanaStateButton.pending,
        [GrafanaAlertState.Recovering]: ui.grafanaStateButton.recovering,
        [GrafanaAlertState.NoData]: ui.grafanaStateButton.noData,
        [GrafanaAlertState.Error]: ui.grafanaStateButton.error,
      };

      render(<RuleDetailsMatchingInstances rule={rule} enableFiltering />);

      await userEvent.click(buttons[state].get());

      expect(ui.instanceRow.getAll()).toHaveLength(1);
      expect(ui.instanceRow.get()).toHaveTextContent(alertStateToReadable(state));
    });

    it('For Cloud rules instances filter should contain two states', () => {
      const rule = mockCombinedRule({
        namespace: mockPromNamespace(),
      });

      render(<RuleDetailsMatchingInstances rule={rule} enableFiltering />);

      const stateFilter = ui.stateFilter.get();
      expect(stateFilter).toBeInTheDocument();

      const stateButtons = ui.stateButton.getAll(stateFilter);

      expect(stateButtons).toHaveLength(2);

      expect(ui.cloudStateButton.firing.get(stateFilter)).toBeInTheDocument();
      expect(ui.cloudStateButton.pending.get(stateFilter)).toBeInTheDocument();
    });

    it.each([PromAlertingRuleState.Pending, PromAlertingRuleState.Firing] as const)(
      'Should filter cloud rules by %s state',
      async (state) => {
        const rule = mockCombinedRule({
          namespace: mockPromNamespace(),
          promRule: mockPromAlertingRule({
            alerts: [
              mockPromAlert({ state: PromAlertingRuleState.Firing }),
              mockPromAlert({ state: PromAlertingRuleState.Pending }),
            ],
          }),
        });

        render(<RuleDetailsMatchingInstances rule={rule} enableFiltering />);

        await userEvent.click(ui.cloudStateButton[state].get());

        expect(ui.instanceRow.getAll()).toHaveLength(1);
        expect(ui.instanceRow.get()).toHaveTextContent(alertStateToReadable(state));
      }
    );

    it('should correctly filter instances', async () => {
      const event = userEvent.setup();

      const rule = mockCombinedRule({
        promRule: mockPromAlertingRule({
          alerts: times(100, () => mockPromAlert({ state: GrafanaAlertState.Normal })),
        }),
        instanceTotals: {
          inactive: 100,
        },
      });

      render(<RuleDetailsMatchingInstances rule={rule} enableFiltering pagination={{ itemsPerPage: 10 }} />);

      // should show all instances by default
      expect(ui.showAllInstances.query()).not.toBeInTheDocument();

      // filter by "error" state, should have no instances in that state
      await event.click(ui.grafanaStateButton.error.get());

      // click "show all" instances
      await event.click(ui.showAllInstances.get());
      expect(ui.showAllInstances.query()).not.toBeInTheDocument();
    });
  });
});

const SILENCE_RULE_UID = 'rule-uid-1';
const SILENCE_FOLDER_UID = 'NAMESPACE_UID';

const instanceWithState = (state: Alert['state'], labels: Record<string, string>) =>
  mockPromAlert({ state, labels: { alertname: 'CPU high', __alert_rule_uid__: SILENCE_RULE_UID, ...labels } });

const grafanaRuleWithInstances = (alerts: Alert[], rulerOverrides: Parameters<typeof mockGrafanaRulerRule>[0] = {}) =>
  mockCombinedRule({
    rulerRule: mockGrafanaRulerRule({ uid: SILENCE_RULE_UID, namespace_uid: SILENCE_FOLDER_UID, ...rulerOverrides }),
    promRule: mockGrafanaPromAlertingRule({ uid: SILENCE_RULE_UID, folderUid: SILENCE_FOLDER_UID, alerts }),
  });

describe('RuleDetailsMatchingInstances silence action', () => {
  let mainView: HTMLDivElement;

  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingInstanceCreate]);
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });
    contextSrv.user.isSignedIn = true;
    contextSrv.user.name = 'admin';

    mainView = document.createElement('div');
    mainView.classList.add('main-view');
    document.body.appendChild(mainView);
  });

  afterEach(() => {
    document.body.removeChild(mainView);
  });

  it('does not render Silence buttons unless the consumer opts in', async () => {
    const rule = grafanaRuleWithInstances([instanceWithState(GrafanaAlertState.Alerting, { instance: 'server-1' })]);

    renderWithProviders(<RuleDetailsMatchingInstances rule={rule} />);

    expect(await screen.findByTestId('row')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^silence$/i })).not.toBeInTheDocument();
  });

  it('renders a Silence button per row and opens the clicked row', async () => {
    const user = userEvent.setup();
    const rule = grafanaRuleWithInstances([
      instanceWithState(GrafanaAlertState.Alerting, { instance: 'server-1', severity: 'critical' }),
      instanceWithState(GrafanaAlertState.Alerting, { instance: 'server-2', severity: 'warning' }),
    ]);

    renderWithProviders(<RuleDetailsMatchingInstances rule={rule} showSilenceAction />);

    const rows = await screen.findAllByTestId('row');
    await user.click(await within(rows[1]).findByRole('button', { name: /^silence$/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('value').map((input) => (input as HTMLInputElement).value)).toEqual([
      'CPU high',
      'server-2',
      'warning',
    ]);
  });

  it('renders a Silence button next to a direct contact point route', async () => {
    const rule = grafanaRuleWithInstances([instanceWithState(GrafanaAlertState.Alerting, { instance: 'server-1' })], {
      notification_settings: { receiver: 'slack' },
    });

    renderWithProviders(<RuleDetailsMatchingInstances rule={rule} showSilenceAction />);

    expect(await screen.findByText('slack')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^silence$/i })).toBeInTheDocument();
  });

  it('renders a Silence button for a prom-only Grafana rule without ruler data', async () => {
    const rule = mockCombinedRule({
      rulerRule: undefined,
      promRule: mockGrafanaPromAlertingRule({
        uid: SILENCE_RULE_UID,
        folderUid: SILENCE_FOLDER_UID,
        alerts: [instanceWithState(GrafanaAlertState.Alerting, { instance: 'server-1' })],
      }),
    });

    renderWithProviders(<RuleDetailsMatchingInstances rule={rule} showSilenceAction />);

    expect(await screen.findByTestId('row')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^silence$/i })).toBeInTheDocument();
  });

  it.each([
    GrafanaAlertState.Alerting,
    GrafanaAlertState.Normal,
    GrafanaAlertState.Pending,
    GrafanaAlertState.Recovering,
  ])('renders a Silence button for a %s instance', async (state) => {
    const rule = grafanaRuleWithInstances([instanceWithState(state, { instance: 'server-1' })]);

    renderWithProviders(<RuleDetailsMatchingInstances rule={rule} showSilenceAction />);

    expect(await screen.findByRole('button', { name: /^silence$/i })).toBeInTheDocument();
  });

  it.each([
    GrafanaAlertState.NoData,
    GrafanaAlertState.Error,
    'NoData (Timeout)' as const,
    'Error (DatasourceError)' as const,
  ])('hides the Silence button for a %s instance', async (state) => {
    const rule = grafanaRuleWithInstances([
      instanceWithState(GrafanaAlertState.Alerting, { instance: 'allowed' }),
      instanceWithState(state, { instance: 'hidden' }),
    ]);

    renderWithProviders(<RuleDetailsMatchingInstances rule={rule} showSilenceAction />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: /^silence$/i })).toHaveLength(1));

    const rows = screen.getAllByTestId('row');
    const allowedRow = rows.find((row) => row.textContent?.includes('allowed'));
    const hiddenRow = rows.find((row) => row.textContent?.includes('hidden'));
    expect(within(allowedRow!).getByRole('button', { name: /^silence$/i })).toBeInTheDocument();
    expect(within(hiddenRow!).queryByRole('button', { name: /^silence$/i })).not.toBeInTheDocument();
  });
});

function mockPromNamespace(): CombinedRuleNamespace {
  return {
    rulesSource: mockDataSource(),
    groups: [{ name: 'Prom rules group', rules: [], totals: {} }],
    name: 'Prometheus-test',
  };
}
