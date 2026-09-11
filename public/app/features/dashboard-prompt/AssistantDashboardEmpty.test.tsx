import { act, fireEvent, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { type ChatContextItem } from '@grafana/assistant';
import { config } from '@grafana/runtime';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';
import { AddNewPane } from 'app/features/dashboard-scene/sidebar/add-new/AddNewPane';

import { AssistantDashboardEmpty } from './AssistantDashboardEmpty';
import { startPlanningInAssistant } from './handoff';

jest.mock('./handoff', () => ({
  startPlanningInAssistant: jest.fn(() => true),
}));

jest.mock('./datasources', () => ({
  getPromptDatasources: () => [{ uid: 'prom-default', type: 'prometheus', name: 'Prometheus' }],
}));

let latestOnSubmit: ((prompt: string, contextItems: ChatContextItem[]) => void) | undefined;

jest.mock('./DashboardLandingPrompt', () => ({
  DashboardLandingPrompt: ({ onSubmit }: { onSubmit: (prompt: string, contextItems: ChatContextItem[]) => void }) => {
    latestOnSubmit = onSubmit;
    return <div data-testid="dashboard-landing-prompt">prompt</div>;
  },
}));

const mockStartPlanning = jest.mocked(startPlanningInAssistant);

function renderEmpty() {
  const dashboard = new DashboardScene({
    isEditing: true,
    body: AutoGridLayoutManager.createEmpty(),
  });
  const addNewPanel = jest.spyOn(dashboard.state.sidebar, 'addNewPanel').mockImplementation(() => {});
  render(<AssistantDashboardEmpty dashboard={dashboard} />);
  return { dashboard, addNewPanel };
}

describe('AssistantDashboardEmpty', () => {
  const originalDashboardNewLayouts = config.featureToggles.dashboardNewLayouts;

  beforeEach(() => {
    jest.clearAllMocks();
    latestOnSubmit = undefined;
    config.featureToggles.dashboardNewLayouts = true;
  });

  afterEach(() => {
    config.featureToggles.dashboardNewLayouts = originalDashboardNewLayouts;
  });

  it('adds a panel through the sidebar instead of opening the panel editor', () => {
    const { addNewPanel } = renderEmpty();

    fireEvent.click(screen.getByRole('button', { name: 'Add visualization' }));

    expect(addNewPanel).toHaveBeenCalledTimes(1);
  });

  it('keeps Grid: outside the layout dropdown', () => {
    renderEmpty();

    expect(screen.getByText('Grid:')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Grid:' })).toHaveDisplayValue('Auto');
  });

  it('derives planning summaries from context data and forwards the original selection', () => {
    const { dashboard } = renderEmpty();
    const contextItems: ChatContextItem[] = [
      {
        node: {
          id: 'datasources/prom-1',
          name: 'Datasource label',
          navigable: false,
          data: {
            type: 'datasource',
            datasourceUid: 'prom-1',
            datasourceName: 'Prometheus',
            datasourceType: 'prometheus',
          },
        },
        occurrences: ['mention-1'],
      },
      {
        node: {
          id: 'dashboards/dash-1',
          name: 'Dashboard label',
          navigable: false,
          data: { type: 'dashboard', dashboardUid: 'dash-1', dashboardTitle: 'Checkout', folderUid: 'folder-2' },
        },
        occurrences: [],
      },
    ];

    act(() => {
      latestOnSubmit?.('monitor checkout', contextItems);
    });

    expect(mockStartPlanning).toHaveBeenCalledWith({
      request: 'monitor checkout',
      displayPrompt: 'monitor checkout',
      datasources: [{ uid: 'prom-1', type: 'prometheus', name: 'Prometheus' }],
      context: contextItems,
      dashboards: [{ uid: 'dash-1', title: 'Checkout' }],
      folderUid: dashboard.state.meta.folderUid,
      skipNavigation: true,
    });
    expect(mockStartPlanning.mock.calls[0][0].context).toBe(contextItems);
  });

  it('passes the destination folder through when the new dashboard lives in one', () => {
    const dashboard = new DashboardScene({
      isEditing: true,
      body: AutoGridLayoutManager.createEmpty(),
      meta: { folderUid: 'folder-1', folderTitle: 'Reliability' },
    });
    jest.spyOn(dashboard.state.sidebar, 'addNewPanel').mockImplementation(() => {});
    render(<AssistantDashboardEmpty dashboard={dashboard} />);

    act(() => {
      latestOnSubmit?.('monitor checkout', []);
    });

    expect(mockStartPlanning).toHaveBeenCalledWith(
      expect.objectContaining({
        folderUid: 'folder-1',
      })
    );
  });

  it('falls back to every datasource when the user picked none', () => {
    renderEmpty();

    act(() => {
      latestOnSubmit?.('monitor checkout', []);
    });

    expect(mockStartPlanning).toHaveBeenCalledWith(
      expect.objectContaining({
        datasources: [{ uid: 'prom-default', type: 'prometheus', name: 'Prometheus' }],
        context: [],
        dashboards: [],
      })
    );
  });

  it('tags the edit session as assistant and blocks the empty canvas once planning starts', () => {
    const { dashboard } = renderEmpty();
    dashboard.state.sidebar.openPane(new AddNewPane({}));

    act(() => {
      latestOnSubmit?.('monitor checkout', []);
    });

    expect(dashboard.getEditSessionSource()).toBe('assistant');
    expect(dashboard.state.sidebar.state.openPane).toBeUndefined();
    expect(screen.getByTestId('dashboard-assistant-interaction-lock')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('leaves the canvas interactive when planning does not start', () => {
    mockStartPlanning.mockReturnValueOnce(false);
    const { dashboard } = renderEmpty();

    act(() => {
      latestOnSubmit?.('monitor checkout', []);
    });

    expect(dashboard.getEditSessionSource()).not.toBe('assistant');
    expect(screen.queryByTestId('dashboard-assistant-interaction-lock')).not.toBeInTheDocument();
  });
});
