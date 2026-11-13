import { act, fireEvent, waitFor } from '@testing-library/react';
import { type JSX } from 'react';
import { render, screen, userEvent } from 'test/test-utils';

import {
  getDefaultTimeRange,
  LoadingState,
  type PluginExtensionDashboardControlsContext,
  type PluginExtensionDashboardControlsPanel,
  PluginExtensionPoints,
} from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { CustomVariable, SceneDataNode, SceneGridLayout, SceneVariableSet, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { ElementSelectionContext } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';
import { ShowConfirmModalEvent } from 'app/types/events';

import { type SceneQuestion } from '../questions/types';
import { QuestionEdit } from '../sidebar/questions/QuestionEdit';

import { DashboardControlsExtensionPoint } from './DashboardControlsExtensionPoint';
import { DashboardScene } from './DashboardScene';
import { WAIT_FOR_MOUSE_REST_DURATION_MS } from './edit-actions-popover/EditActionsPopover';
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
      return <button>{props.questions.map((question) => question.title ?? question.text).join(', ')}</button>;
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

  it('gives plugin controls the title to show instead of the question', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    renderControls([
      { text: 'Which services drove the rise in errors?', title: 'Errors' },
      { text: 'Why?', title: ' ' },
    ]);

    expect(receivedProps.mock.lastCall?.[0].questions).toEqual([
      { text: 'Which services drove the rise in errors?', title: 'Errors' },
      { text: 'Why?' },
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
    const saved: SceneQuestion[] = JSON.parse('[{ "text": 42 }, { "text": "What stands out?" }]');
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
    ['a panel is edited', { isEditing: true, editPanel: {} as DashboardSceneState['editPanel'] }],
    [
      'a plan is previewed',
      {
        planning: { phase: 'preview', planId: 'plan-1', planTitle: 'Plan', onBuild: jest.fn(), onDismiss: jest.fn() },
      },
    ],
  ])('renders no controls while %s', (_, dashboardState) => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    const { container } = renderControls(undefined, dashboardState, 'v2');

    expect(container).toBeEmptyDOMElement();
  });

  describe('while the dashboard is edited', () => {
    const questions = [{ text: 'What stands out?' }, { text: 'Why did errors rise?' }];

    it('renders each question as its own control', () => {
      setTestFlags({ 'grafana.dashboardQuestions': true });
      renderControls(questions, { isEditing: true }, 'v2');

      // The control joins the questions it gets, so one control for both would show them as one button.
      expect(screen.getByRole('button', { name: 'What stands out?' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Why did errors rise?' })).toBeInTheDocument();
    });

    // A v1 save drops the questions, so editors can't change them.
    it('renders no controls on a dashboard that saves as v1', () => {
      setTestFlags({ 'grafana.dashboardQuestions': true });
      const { container } = renderControls(questions, { isEditing: true }, 'v1');

      expect(container).toBeEmptyDOMElement();
    });

    it('opens a question for editing from its control', async () => {
      setTestFlags({ 'grafana.dashboardQuestions': true });
      const { dashboard } = renderEditableControls(questions);

      await hoverAndRest(screen.getByRole('button', { name: 'Why did errors rise?' }));
      await userEvent.click(screen.getByRole('button', { name: 'Question settings' }));

      await waitFor(() => {
        const selected = dashboard.state.sidebar.getSelectedObject();
        expect(selected instanceof QuestionEdit && selected.state.questionIndex).toBe(1);
      });
    });

    it('deletes a question from its control once the editor confirms', async () => {
      setTestFlags({ 'grafana.dashboardQuestions': true });
      const publish = jest.spyOn(appEvents, 'publish');
      const { dashboard } = renderEditableControls(questions);

      await hoverAndRest(screen.getByRole('button', { name: 'What stands out?' }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const confirm = publish.mock.calls
        .map(([event]) => event)
        .find((event) => event instanceof ShowConfirmModalEvent);
      act(() => confirm?.payload.onConfirm?.());

      expect(dashboard.state.questions).toEqual([{ text: 'Why did errors rise?' }]);
      publish.mockRestore();
    });

    // Asking a question while it is edited leaves it open in the sidebar, so the editor can change it and ask again.
    it('keeps a click on a question from reaching the dashboard, which would clear the selection', () => {
      setTestFlags({ 'grafana.dashboardQuestions': true });
      const { onDashboardPointerDown } = renderEditableControls(questions);

      fireEvent.pointerDown(screen.getByRole('button', { name: 'What stands out?' }));

      expect(onDashboardPointerDown).not.toHaveBeenCalled();
    });
  });
});

async function hoverAndRest(element: HTMLElement) {
  jest.useFakeTimers();
  try {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.hover(element);
    act(() => {
      jest.advanceTimersByTime(WAIT_FOR_MOUSE_REST_DURATION_MS);
    });
  } finally {
    jest.useRealTimers();
  }
}

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
function buildDashboard(
  dashboardState: Partial<DashboardSceneState>,
  errorsState: Partial<RowItemState> = {},
  serializerVersion: 'v1' | 'v2' = 'v1'
) {
  const errors = new RowItem({
    title: 'Errors',
    layout: grid(errorRate, latency),
    questions: [{ text: 'Why did errors rise?' }],
    ...errorsState,
  });
  const traffic = new RowItem({ title: 'Traffic', layout: grid(requests) });
  const dashboard = new DashboardScene(
    {
      uid: 'checkout',
      title: 'Checkout',
      body: new RowsLayoutManager({ rows: [traffic, errors] }),
      ...dashboardState,
    },
    serializerVersion
  );
  return { dashboard, errors };
}

function renderControls(
  questions: SceneQuestion[] = [{ text: 'What stands out?' }],
  dashboardState: Partial<DashboardSceneState> = {},
  serializerVersion: 'v1' | 'v2' = 'v1'
) {
  const { dashboard } = buildDashboard({ ...dashboardState, questions }, {}, serializerVersion);
  return render(<DashboardControlsExtensionPoint dashboard={dashboard} />);
}

/** The controls of an edited dashboard, with its sidebar active, which turns selection on. */
function renderEditableControls(questions: SceneQuestion[]) {
  const { dashboard } = buildDashboard({ isEditing: true, questions }, {}, 'v2');
  act(() => {
    dashboard.state.sidebar.activate();
  });
  const onDashboardPointerDown = jest.fn();
  render(
    <ElementSelectionContext.Provider value={dashboard.state.sidebar.state.selectionContext}>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div onPointerDown={onDashboardPointerDown}>
        <DashboardControlsExtensionPoint dashboard={dashboard} />
      </div>
    </ElementSelectionContext.Provider>
  );
  return { dashboard, onDashboardPointerDown };
}

function renderRowControls(rowState: Partial<RowItemState>) {
  const { errors } = buildDashboard({}, rowState);
  return render(<DashboardControlsExtensionPoint section={errors} />);
}
