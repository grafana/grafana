import { act } from '@testing-library/react';
import { type JSX } from 'react';
import { render, screen } from 'test/test-utils';

import {
  getDefaultTimeRange,
  LoadingState,
  type PluginExtensionDashboardControlsContext,
  type PluginExtensionDashboardControlsPanel,
  PluginExtensionPoints,
} from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { CustomVariable, SceneDataNode, SceneGridLayout, SceneVariableSet, VizPanel } from '@grafana/scenes';
import { type Question } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { DashboardControlsExtensionPoint } from './DashboardControlsExtensionPoint';
import { DashboardScene } from './DashboardScene';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowItem, type RowItemState } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { type DashboardSceneState } from './types/dashboard';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponents: jest.fn(),
}));

type ControlProps = PluginExtensionDashboardControlsContext & JSX.IntrinsicAttributes;

// The props the plugin control got on its last render.
const receivedProps = jest.fn<void, [ControlProps]>();

const PluginControl = createComponentWithMeta<ControlProps>(
  {
    pluginId: 'grafana-assistant-app',
    title: 'Ask Assistant',
    component: (props) => {
      receivedProps(props);
      return <div>{props.questions.map((question) => question.text).join(', ')}</div>;
    },
  },
  PluginExtensionPoints.DashboardControls
);

describe('DashboardControlsExtensionPoint', () => {
  beforeEach(() => {
    jest.mocked(usePluginComponents<ControlProps>).mockReturnValue({ components: [PluginControl], isLoading: false });
  });

  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('gives plugin controls the questions saved on the dashboard', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    renderControls();

    expect(screen.getByText('What stands out?')).toBeInTheDocument();
  });

  it('gives each question the panels to answer it from: the ones picked, or every panel on the dashboard', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    renderControls([{ text: 'What stands out?' }, { text: 'Why did errors rise?', sources: [{ panelId: 3 }] }]);

    const props = receivedProps.mock.lastCall?.[0];
    expect(props).toMatchObject({
      dashboard: { uid: 'checkout', title: 'Checkout' },
      scope: 'dashboard',
      panels: [requests, errorRate, latency],
    });
    expect(props?.questions).toEqual([
      { text: 'What stands out?' },
      { text: 'Why did errors rise?', panels: [errorRate] },
    ]);
  });

  it('answers a question from every panel once the panels it picked are removed', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    renderControls([{ text: 'Why did errors rise?', sources: [{ panelId: 9 }] }]);

    expect(receivedProps.mock.lastCall?.[0].questions).toEqual([{ text: 'Why did errors rise?' }]);
  });

  it('renders no plugin controls while grafana.dashboardQuestions is off', () => {
    setTestFlags({ 'grafana.dashboardQuestions': false });
    renderControls();

    expect(screen.queryByText('What stands out?')).not.toBeInTheDocument();
  });

  it('leaves out questions without text, and renders no controls when none has any', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    const { unmount } = renderControls([{ text: 'What stands out?' }, { text: '  ' }]);

    // The control joins the questions it gets, so a blank one would show up as a trailing comma.
    expect(screen.getByText('What stands out?')).toBeInTheDocument();

    unmount();
    const { container } = renderControls([{ text: '' }]);

    expect(container).toBeEmptyDOMElement();
  });

  it('gives a row control the panels in the row, and the row title as the viewer sees it', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    renderRowControls({});

    expect(receivedProps.mock.lastCall?.[0]).toMatchObject({
      scope: 'row',
      sectionLabel: 'Errors',
      panels: [errorRate, latency],
      questions: [{ text: 'Why did errors rise?' }],
    });
  });

  it('leaves out a saved question whose text is not a string, with the toggle on or off', () => {
    // Saved JSON isn't validated.
    const saved: Question[] = JSON.parse('[{ "text": 42 }, { "text": "What stands out?" }]');
    setTestFlags({ 'grafana.dashboardQuestions': false });
    const { unmount } = renderControls(saved);
    unmount();

    setTestFlags({ 'grafana.dashboardQuestions': true });
    renderControls(saved);

    expect(receivedProps.mock.lastCall?.[0].questions).toEqual([{ text: 'What stands out?' }]);
  });

  it('gives a row control the row title as it reads after a variable changes', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    const service = new CustomVariable({ name: 'service', query: 'api,web', value: 'api', text: 'api' });
    const { errors } = buildDashboard(
      { $variables: new SceneVariableSet({ variables: [service] }) },
      { title: 'Errors in $service' }
    );
    render(<DashboardControlsExtensionPoint section={errors} />);
    expect(receivedProps.mock.lastCall?.[0].sectionLabel).toBe('Errors in api');

    act(() => service.changeValueTo('web', 'web'));

    expect(receivedProps.mock.lastCall?.[0].sectionLabel).toBe('Errors in web');
  });

  // Repeat clones' panels are never passed on, so a later repeat would answer from the first repeat's panels.
  it('renders no controls on a repeated row after the first', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    const { container } = renderRowControls({ key: 'row-1-clone-1', repeatSourceKey: 'row-1' });

    expect(container).toBeEmptyDOMElement();
  });

  it.each<[string, Partial<DashboardSceneState>]>([
    ['the dashboard is edited', { isEditing: true }],
    [
      'a plan is previewed',
      {
        planning: { phase: 'preview', planId: 'plan-1', planTitle: 'Plan', onBuild: jest.fn(), onDismiss: jest.fn() },
      },
    ],
  ])('renders no controls while %s', (_, dashboardState) => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    const { container } = renderControls(undefined, dashboardState);

    expect(container).toBeEmptyDOMElement();
  });
});

const requests: PluginExtensionDashboardControlsPanel = { key: 'panel-1', title: 'Requests' };
const errorRate: PluginExtensionDashboardControlsPanel = { key: 'panel-3', title: 'Error rate' };
const latency: PluginExtensionDashboardControlsPanel = { key: 'panel-4', title: 'Latency' };

function grid(...panels: PluginExtensionDashboardControlsPanel[]) {
  const children = panels.map(
    ({ key, title }) =>
      new DashboardGridItem({
        body: new VizPanel({
          key,
          title,
          pluginId: 'timeseries',
          $data: new SceneDataNode({
            data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() },
          }),
        }),
      })
  );
  return new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children }) });
}

/** A "Traffic" row with a "Requests" panel, and an "Errors" row with "Error rate" and "Latency" panels. */
function buildDashboard(dashboardState: Partial<DashboardSceneState>, errorsState: Partial<RowItemState> = {}) {
  const errors = new RowItem({
    title: 'Errors',
    layout: grid(errorRate, latency),
    questions: [{ text: 'Why did errors rise?' }],
    ...errorsState,
  });
  const traffic = new RowItem({ title: 'Traffic', layout: grid(requests) });
  const dashboard = new DashboardScene({
    uid: 'checkout',
    title: 'Checkout',
    body: new RowsLayoutManager({ rows: [traffic, errors] }),
    ...dashboardState,
  });
  return { dashboard, errors };
}

function renderControls(
  questions: Question[] = [{ text: 'What stands out?' }],
  dashboardState: Partial<DashboardSceneState> = {}
) {
  const { dashboard } = buildDashboard({ ...dashboardState, questions });
  return render(<DashboardControlsExtensionPoint dashboard={dashboard} />);
}

function renderRowControls(rowState: Partial<RowItemState>) {
  const { errors } = buildDashboard({}, rowState);
  return render(<DashboardControlsExtensionPoint section={errors} />);
}
