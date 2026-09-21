import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { hasSeenAgentSetup } from 'app/features/agent-handoff/agents';
import { openAgentPromptDeeplink } from 'app/features/agent-handoff/deeplinks';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { OpenPanelInAgentTab } from './OpenPanelInAgentTab';

// The one collaborator worth mocking: assigning window.location.href to invoke a
// protocol handler is not implemented in jsdom.
jest.mock('app/features/agent-handoff/deeplinks', () => ({
  ...jest.requireActual('app/features/agent-handoff/deeplinks'),
  openAgentPromptDeeplink: jest.fn(),
}));

describe('OpenPanelInAgentTab', () => {
  const originalAppUrl = config.appUrl;

  beforeEach(() => {
    config.appUrl = 'https://grafana.example.com/';
    window.localStorage.clear();
    jest.mocked(openAgentPromptDeeplink).mockClear();
  });

  afterAll(() => {
    config.appUrl = originalAppUrl;
  });

  it('leads with installing the binary both clients are pointed at', () => {
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);

    expect(screen.getByRole('textbox', { name: 'Install command' })).toHaveValue(
      'GOBIN="$HOME/go/bin" go install github.com/grafana/mcp-grafana/cmd/mcp-grafana@latest'
    );
  });

  it('shows the connect step for each agent, with the token left as an environment reference', () => {
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);

    expect(screen.getByRole('link', { name: 'Add the Grafana MCP server to Cursor' })).toHaveAttribute(
      'href',
      expect.stringContaining('cursor://anysphere.cursor-deeplink/mcp/install')
    );
    expect(screen.getByRole('textbox', { name: 'Claude Code' })).toHaveValue(
      'claude mcp add -s user grafana -e GRAFANA_URL=https://grafana.example.com ' +
        "-e 'GRAFANA_SERVICE_ACCOUNT_TOKEN=${GRAFANA_SERVICE_ACCOUNT_TOKEN}' -- mcp-grafana --transport stdio"
    );
  });

  it('hands the chosen agent a prompt naming the panel, and remembers the setup step was seen', async () => {
    const { tab } = setupScenario();
    const user = userEvent.setup();

    render(<tab.Component model={tab} />);
    await user.click(screen.getByRole('button', { name: 'Cursor' }));

    expect(openAgentPromptDeeplink).toHaveBeenCalledWith(
      'cursor',
      expect.stringContaining(
        'Show me the "p95 latency" panel (panel 4) from Grafana dashboard dash-1, over now-6h to now.'
      )
    );
    // Seen, so the menu stops routing through this drawer for Cursor from now on.
    expect(hasSeenAgentSetup('cursor')).toBe(true);
    expect(hasSeenAgentSetup('claude')).toBe(false);
  });

  it('carries the panel id the tool needs, not just the title', async () => {
    const { tab } = setupScenario();
    const user = userEvent.setup();

    render(<tab.Component model={tab} />);
    await user.click(screen.getByRole('button', { name: 'Claude Code' }));

    expect(jest.mocked(openAgentPromptDeeplink).mock.calls[0][1]).toContain('panelIds [4]');
  });
});

function setupScenario() {
  const panel = new VizPanel({ key: 'panel-4', pluginId: 'timeseries', title: 'p95 latency' });
  const gridItem = new DashboardGridItem({ key: 'grid-item-1', body: panel });

  const dashboard = new DashboardScene({
    title: 'Dash',
    uid: 'dash-1',
    meta: { canEdit: true },
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [gridItem] }) }),
  });

  const tab = new OpenPanelInAgentTab({ panelRef: panel.getRef() });
  dashboard.showModal(tab);

  return { tab, dashboard, panel };
}
