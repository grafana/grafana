import { act, fireEvent, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';
import { AddNewPane } from 'app/features/dashboard-scene/sidebar/add-new/AddNewPane';

import { AssistantDashboardEmpty } from './AssistantDashboardEmpty';
import { startPlanningInAssistant } from './handoff';
import { type DashboardLandingPromptSelection } from './types';

jest.mock('./handoff', () => ({
  startPlanningInAssistant: jest.fn(() => true),
}));

jest.mock('./datasources', () => ({
  getPromptDatasources: () => [{ uid: 'prom-default', type: 'prometheus', name: 'Prometheus' }],
}));

let latestOnSubmit: ((prompt: string, selection: DashboardLandingPromptSelection[]) => void) | undefined;

jest.mock('./DashboardLandingPrompt', () => ({
  DashboardLandingPrompt: ({
    onSubmit,
  }: {
    onSubmit: (prompt: string, selection: DashboardLandingPromptSelection[]) => void;
  }) => {
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

  it('hands the prompt and picked datasources to planning without navigating', () => {
    const { dashboard } = renderEmpty();

    act(() => {
      latestOnSubmit?.('monitor checkout', [
        { kind: 'datasource', uid: 'prom-1', name: 'Prometheus', datasourceType: 'prometheus' },
        { kind: 'dashboard', uid: 'dash-1', name: 'Checkout' },
      ]);
    });

    expect(mockStartPlanning).toHaveBeenCalledWith({
      request: 'monitor checkout',
      displayPrompt: 'monitor checkout',
      datasources: [{ uid: 'prom-1', type: 'prometheus', name: 'Prometheus' }],
      attachedDatasources: [{ uid: 'prom-1', type: 'prometheus', name: 'Prometheus' }],
      dashboards: [{ uid: 'dash-1', title: 'Checkout' }],
      folderUid: dashboard.state.meta.folderUid,
      skipNavigation: true,
    });
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
        attachedDatasources: [],
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
