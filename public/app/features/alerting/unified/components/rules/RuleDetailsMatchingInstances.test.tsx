import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { times } from 'lodash';
import { Subject, of } from 'rxjs';
import { byLabelText, byRole, byTestId } from 'testing-library-selector';

import { type PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { setGetObservablePluginLinks } from '@grafana/runtime/internal';

import { type CombinedRuleNamespace } from '../../../../../types/unified-alerting';
import { GrafanaAlertState, PromAlertingRuleState, PromRuleType } from '../../../../../types/unified-alerting-dto';
import { mockCombinedRule, mockDataSource, mockPromAlert, mockPromAlertingRule } from '../../mocks';
import { alertStateToReadable } from '../../utils/rules';

import { RuleDetailsMatchingInstances } from './RuleDetailsMatchingInstances';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginLinkExtensions: jest.fn(),
  usePluginLinks: jest.fn(),
}));

const mocks = {
  usePluginLinksMock: jest.mocked(usePluginLinks),
};

// Default mock link returned by both usePluginLinks (per-row rendering) and
// getObservablePluginLinks (table-level column visibility).
const defaultLink: PluginExtensionLink = {
  pluginId: 'grafana-ml-app',
  id: '1',
  type: PluginExtensionTypes.link,
  title: 'Run investigation',
  category: 'Sift',
  description: 'Run a Sift investigation for this alert',
  onClick: jest.fn(),
};

const ui = {
  stateFilter: byTestId('alert-instance-state-filter'),
  actionsButton: byLabelText('Alert instance actions'),
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
    // Per-row rendering: usePluginLinks returns a link by default
    mocks.usePluginLinksMock.mockReturnValue({
      links: [defaultLink],
      isLoading: false,
    });

    // Table-level column visibility: getObservablePluginLinks returns a link by default
    setGetObservablePluginLinks(jest.fn().mockReturnValue(of([defaultLink])));
  });

  it('should render plugin actions for alert instances when extensions are available', () => {
    const rule = mockCombinedRule();
    const alerts = rule.promRule?.type === PromRuleType.Alerting ? (rule.promRule.alerts ?? []) : [];

    render(<RuleDetailsMatchingInstances rule={rule} />);

    expect(ui.actionsButton.getAll()).toHaveLength(alerts.length);
  });

  describe('plugin-actions column visibility', () => {
    // Case A: no applicable plugin links → column must not appear
    it('does not render plugin-actions column when no instance has applicable plugin links', async () => {
      // Both the observable (column visibility) and usePluginLinks (per-row) return no links
      setGetObservablePluginLinks(jest.fn().mockReturnValue(of([])));
      mocks.usePluginLinksMock.mockReturnValue({ links: [], isLoading: false });

      const rule = mockCombinedRule();
      render(<RuleDetailsMatchingInstances rule={rule} />);

      await waitFor(() => {
        expect(ui.actionsButton.query()).not.toBeInTheDocument();
      });
    });

    // Case B: context-dependent link — plugin returns a link only when context matches
    it('renders plugin action only for the matching instance', async () => {
      const specialLabel = 'special-instance';

      // getObservablePluginLinks: return a link only for the instance whose labels contain specialLabel
      setGetObservablePluginLinks(
        jest.fn().mockImplementation(({ context }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasSpecialLabel = (context as any)?.instance?.labels?.role === specialLabel;
          return of(hasSpecialLabel ? [defaultLink] : []);
        })
      );

      // usePluginLinks: return a link only for instances whose context matches
      mocks.usePluginLinksMock.mockImplementation(({ context }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasSpecialLabel = (context as any)?.instance?.labels?.role === specialLabel;
        return { links: hasSpecialLabel ? [defaultLink] : [], isLoading: false };
      });

      const rule = mockCombinedRule({
        promRule: mockPromAlertingRule({
          alerts: [
            mockPromAlert({ labels: { alertname: 'a', role: specialLabel } }),
            mockPromAlert({ labels: { alertname: 'b', role: 'other' } }),
          ],
        }),
      });

      render(<RuleDetailsMatchingInstances rule={rule} />);

      // Column appears because at least one instance has a link
      await waitFor(() => {
        expect(ui.actionsButton.getAll()).toHaveLength(1);
      });
    });

    // Case C: multiple instances — links resolved per instance
    it('renders the correct number of plugin actions for multiple matching instances', async () => {
      const rule = mockCombinedRule({
        promRule: mockPromAlertingRule({
          alerts: [
            mockPromAlert({ labels: { alertname: 'a' } }),
            mockPromAlert({ labels: { alertname: 'b' } }),
            mockPromAlert({ labels: { alertname: 'c' } }),
          ],
        }),
      });

      // All instances match
      setGetObservablePluginLinks(jest.fn().mockReturnValue(of([defaultLink])));
      mocks.usePluginLinksMock.mockReturnValue({ links: [defaultLink], isLoading: false });

      render(<RuleDetailsMatchingInstances rule={rule} />);

      await waitFor(() => {
        expect(ui.actionsButton.getAll()).toHaveLength(3);
      });
    });

    // Case D: isLoading — column should not be hidden while links are still loading
    it('preserves plugin-actions column while links are loading', async () => {
      // Use a Subject that never emits — the observable is pending (loading)
      const pending$ = new Subject<PluginExtensionLink[]>();
      setGetObservablePluginLinks(jest.fn().mockReturnValue(pending$));

      // Per-row rendering: return a link (so action buttons appear once column is visible)
      mocks.usePluginLinksMock.mockReturnValue({ links: [defaultLink], isLoading: true });

      const rule = mockCombinedRule();
      render(<RuleDetailsMatchingInstances rule={rule} />);

      // While observable hasn't emitted, isLoading=true → column is included defensively
      // The action buttons come from usePluginLinks (per-row), which does return links
      await waitFor(() => {
        const alerts = rule.promRule?.type === PromRuleType.Alerting ? (rule.promRule.alerts ?? []) : [];
        expect(ui.actionsButton.getAll()).toHaveLength(alerts.length);
      });
    });

    // Case E: existing test — plugin actions render for matching instances
    it('renders plugin actions for all instances when extensions are available (preserved test)', () => {
      const rule = mockCombinedRule();
      const alerts = rule.promRule?.type === PromRuleType.Alerting ? (rule.promRule.alerts ?? []) : [];

      render(<RuleDetailsMatchingInstances rule={rule} />);

      expect(ui.actionsButton.getAll()).toHaveLength(alerts.length);
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

function mockPromNamespace(): CombinedRuleNamespace {
  return {
    rulesSource: mockDataSource(),
    groups: [{ name: 'Prom rules group', rules: [], totals: {} }],
    name: 'Prometheus-test',
  };
}
