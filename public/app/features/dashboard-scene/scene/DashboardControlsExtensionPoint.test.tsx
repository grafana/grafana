import { act } from '@testing-library/react';
import { type JSX } from 'react';
import { render, screen } from 'test/test-utils';

import { type PluginExtensionDashboardControlsContext, PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { type Question } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { ALL_PANELS_REF, sectionRef } from '../data-service/sections';

import { DashboardControlsExtensionPoint } from './DashboardControlsExtensionPoint';
import { DashboardScene } from './DashboardScene';
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

    expect(receivedProps.mock.lastCall?.[0].questions).toEqual([
      { text: 'What stands out?', sourceRefs: [ALL_PANELS_REF] },
      { text: 'Why did errors rise?', sourceRefs: ['panel-3'] },
    ]);
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
      sourceRef: sectionRef(['Errors']),
      sectionLabel: 'Errors',
      questions: [{ text: 'Why did errors rise?', sourceRefs: [sectionRef(['Errors'])] }],
    });
  });

  // The dashboard data API reads only the first repeat's panels, so a later one would answer from the first's data.
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

function renderControls(
  questions: Question[] = [{ text: 'What stands out?' }],
  dashboardState: Partial<DashboardSceneState> = {}
) {
  const dashboard = new DashboardScene({ ...dashboardState, questions });
  return render(<DashboardControlsExtensionPoint owner={dashboard} />);
}

function renderRowControls(rowState: Partial<RowItemState>) {
  const row = new RowItem({ title: 'Errors', questions: [{ text: 'Why did errors rise?' }], ...rowState });
  new DashboardScene({ body: new RowsLayoutManager({ rows: [row] }) });
  return render(<DashboardControlsExtensionPoint owner={row} />);
}
