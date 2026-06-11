import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VizPanel } from '@grafana/scenes';
import { type Panel } from '@grafana/schema';

import { DashboardIntentSummaryBar } from './DashboardIntentSummaryBar';
import { DashboardScene, type DashboardSceneState } from './DashboardScene';
import { PanelIntentChips } from './PanelIntentChips';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

type PanelIntent = NonNullable<Panel['intent']>;

jest.mock('../edit-pane/shared', () => ({
  dashboardEditActions: {
    // Execute perform immediately so tests don't wait on the undo stack.
    edit: ({ perform }: { perform: () => void }) => perform(),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  // The bar publishes active matches on the AppEvents bus; stub it so tests
  // don't need a live event bus.
  getAppEvents: () => ({ publish: jest.fn() }),
}));

interface PanelSpec {
  intent: PanelIntent;
  activeMatch?: { since: number };
}

interface BuildOpts {
  intent?: DashboardSceneState['intent'];
  isEditing?: boolean;
  panelIntents?: Array<PanelIntent | PanelSpec | undefined>;
}

function buildDashboard(opts: BuildOpts = {}): DashboardScene {
  const { intent, isEditing, panelIntents = [] } = opts;
  const panels = panelIntents.map((entry, i) => {
    const spec: PanelSpec | undefined =
      entry === undefined ? undefined : 'intent' in entry ? (entry as PanelSpec) : { intent: entry as PanelIntent };
    return new VizPanel({
      key: `panel-${i}`,
      title: `Panel ${i}`,
      pluginId: 'timeseries',
      titleItems: spec ? [new PanelIntentChips({ intent: spec.intent, activeMatch: spec.activeMatch })] : [],
    });
  });
  const scene = new DashboardScene({
    title: 'Test',
    uid: 'dash-1',
    meta: {},
    intent,
    isEditing,
    body: DefaultGridLayoutManager.fromVizPanels(panels),
  });
  scene.activate();
  return scene;
}

describe('DashboardIntentSummaryBar', () => {
  describe('visibility gate', () => {
    it('renders nothing on a dashboard with no intent anywhere', () => {
      const { container } = render(<DashboardIntentSummaryBar dashboard={buildDashboard()} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when the dashboard intent block is present but empty', () => {
      const { container } = render(<DashboardIntentSummaryBar dashboard={buildDashboard({ intent: {} })} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing in edit mode until some intent exists', () => {
      const { container } = render(<DashboardIntentSummaryBar dashboard={buildDashboard({ isEditing: true })} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders once a dashboard-level owner or purpose is set', () => {
      render(<DashboardIntentSummaryBar dashboard={buildDashboard({ intent: { owner: '@team' } })} />);
      expect(screen.getByTestId('dashboard-intent-summary-bar')).toBeInTheDocument();
    });

    it('renders once a panel carries intent, even with no dashboard-level intent', () => {
      const dashboard = buildDashboard({ panelIntents: [{ failureModes: [{ tag: 'db-slow' }] }] });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);
      expect(screen.getByTestId('dashboard-intent-summary-bar')).toBeInTheDocument();
    });
  });

  describe('read mode', () => {
    it('renders dashboard purpose and owner', () => {
      const dashboard = buildDashboard({
        intent: { purpose: 'Track checkout p99 latency.', owner: '@checkout-team' },
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);

      expect(screen.getByText('Track checkout p99 latency.')).toBeInTheDocument();
      expect(screen.getByText('@checkout-team')).toBeInTheDocument();
    });

    it('aggregates failure modes and runbooks from panels', () => {
      const dashboard = buildDashboard({
        intent: { purpose: 'Checkout health.' },
        panelIntents: [
          {
            failureModes: [{ tag: 'deploy-regression', description: 'Elevated p99 after a deploy.' }],
            runbooks: [{ title: 'Checkout runbook', url: 'https://wiki/checkout' }],
          },
          {
            failureModes: [{ tag: 'db-slow' }],
          },
        ],
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);

      expect(screen.getByText('deploy-regression')).toBeInTheDocument();
      expect(screen.getByText('db-slow')).toBeInTheDocument();
      const runbookLink = screen.getByRole('link', { name: /Checkout runbook/ });
      expect(runbookLink).toHaveAttribute('href', 'https://wiki/checkout');
      expect(runbookLink).toHaveAttribute('target', '_blank');
    });

    it('dedupes failure modes and runbooks shared across panels', () => {
      const dashboard = buildDashboard({
        intent: { purpose: 'Checkout health.' },
        panelIntents: [
          {
            failureModes: [{ tag: 'db-slow' }],
            runbooks: [{ title: 'On-call', url: 'https://wiki/oncall' }],
          },
          {
            failureModes: [{ tag: 'db-slow' }],
            runbooks: [{ title: 'On-call', url: 'https://wiki/oncall' }],
          },
        ],
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);

      expect(screen.getAllByText('db-slow')).toHaveLength(1);
      expect(screen.getAllByRole('link', { name: /On-call/ })).toHaveLength(1);
    });

    it('does not surface dashboard-level failure modes (those come from panels)', () => {
      const dashboard = buildDashboard({
        intent: { purpose: 'x', failureModes: [{ tag: 'should-not-show' }] },
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);
      expect(screen.queryByText('should-not-show')).not.toBeInTheDocument();
    });

    it('collapses the body when the user clicks the chevron, keeping the header visible', async () => {
      const dashboard = buildDashboard({
        intent: { purpose: 'Track checkout p99 latency.', owner: '@checkout-team' },
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);

      expect(screen.getByText('Track checkout p99 latency.')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /Collapse dashboard intent/i }));

      expect(screen.queryByText('Track checkout p99 latency.')).not.toBeInTheDocument();
      expect(screen.getByText('@checkout-team')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Expand dashboard intent/i })).toBeInTheDocument();
    });
  });

  describe('active failure-mode chips (Phase F-lite)', () => {
    it('reddens only the chips matching on a breaching panel (and shows no banner)', async () => {
      const dashboard = buildDashboard({
        intent: { purpose: 'Checkout health.' },
        panelIntents: [
          { intent: { failureModes: [{ tag: 'cpu-saturation' }] }, activeMatch: { since: 1 } },
          { intent: { failureModes: [{ tag: 'oom' }] } },
        ],
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);

      // The old dashboard-level banner is gone.
      expect(screen.queryByTestId('dashboard-intent-health-strip')).not.toBeInTheDocument();

      // The matching chip's tooltip leads with "Currently matching".
      await userEvent.hover(screen.getByText('cpu-saturation'));
      expect(await screen.findByText(/Currently matching/)).toBeInTheDocument();
    });

    it('does not mark a chip whose panel is not breaching', async () => {
      const dashboard = buildDashboard({
        intent: { purpose: 'Checkout health.' },
        panelIntents: [
          { intent: { failureModes: [{ tag: 'cpu-saturation' }] }, activeMatch: { since: 1 } },
          { intent: { failureModes: [{ tag: 'oom' }] } },
        ],
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);

      // 'oom' is only declared on a non-breaching panel, so it stays quiet.
      await userEvent.hover(screen.getByText('oom'));
      expect(screen.queryByText(/Currently matching/)).not.toBeInTheDocument();
    });

    it('marks no chip as matching when no panel is breaching', async () => {
      const dashboard = buildDashboard({
        intent: { purpose: 'Checkout health.' },
        panelIntents: [{ failureModes: [{ tag: 'cpu-saturation' }] }],
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);

      await userEvent.hover(screen.getByText('cpu-saturation'));
      expect(screen.queryByText(/Currently matching/)).not.toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('shows the get-started CTA when a panel has intent but owner/purpose are empty', () => {
      const dashboard = buildDashboard({
        isEditing: true,
        panelIntents: [{ failureModes: [{ tag: 'db-slow' }] }],
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);

      expect(screen.getByText(/Add a purpose and owner/i)).toBeInTheDocument();
    });

    it('hides the CTA once owner and purpose are set', () => {
      const dashboard = buildDashboard({
        isEditing: true,
        intent: { owner: '@team', purpose: 'Set' },
        panelIntents: [{ failureModes: [{ tag: 'db-slow' }] }],
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);

      expect(screen.queryByText(/Add a purpose and owner/i)).not.toBeInTheDocument();
    });

    it('edits the owner inline and commits it to dashboard intent', async () => {
      const dashboard = buildDashboard({
        isEditing: true,
        panelIntents: [{ failureModes: [{ tag: 'db-slow' }] }],
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);

      await userEvent.type(screen.getByPlaceholderText('@team-handle'), '@me');

      expect(dashboard.state.intent?.owner).toBe('@me');
      expect(dashboard.state.intent?.provenance?.owner).toBe('author-written');
    });

    it('edits the purpose inline and commits it to dashboard intent', async () => {
      const dashboard = buildDashboard({
        isEditing: true,
        panelIntents: [{ failureModes: [{ tag: 'db-slow' }] }],
      });
      render(<DashboardIntentSummaryBar dashboard={dashboard} />);

      await userEvent.type(
        screen.getByPlaceholderText(/Describe what this dashboard is for/i),
        'Checkout latency'
      );

      expect(dashboard.state.intent?.purpose).toBe('Checkout latency');
      expect(dashboard.state.intent?.provenance?.purpose).toBe('author-written');
    });
  });
});
