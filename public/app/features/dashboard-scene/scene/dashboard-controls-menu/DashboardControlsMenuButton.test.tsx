import { act } from '@testing-library/react';
import { type JSX } from 'react';
import { render, screen, userEvent } from 'test/test-utils';

import { type PluginExtensionDashboardControlsContext, PluginExtensionPoints, VariableHide } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { SceneVariableSet, TextBoxVariable, QueryVariable, CustomVariable, type SceneVariable } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { type SceneQuestion } from '../../questions/types';
import { DashboardScene } from '../DashboardScene';

import {
  DASHBOARD_CONTROLS_MENU_ARIA_LABEL,
  DASHBOARD_CONTROLS_MENU_TITLE,
  DashboardControlsButton,
} from './DashboardControlsMenuButton';
import { hasDashboardControls } from './utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponents: jest.fn(),
}));

type ControlProps = PluginExtensionDashboardControlsContext & JSX.IntrinsicAttributes;

const PluginControl = createComponentWithMeta<ControlProps>(
  {
    pluginId: 'grafana-assistant-app',
    title: 'Ask Assistant',
    component: (props) => (
      <button>{props.questions.map((question) => question.title ?? question.text).join(', ')}</button>
    ),
  },
  PluginExtensionPoints.DashboardControls
);

describe('DashboardControlsMenu', () => {
  beforeEach(() => {
    jest.mocked(usePluginComponents<ControlProps>).mockReturnValue({ components: [], isLoading: false });
  });

  it('should return null and not render anything when there are no variables', () => {
    const { container } = render(<DashboardControlsButton dashboard={getDashboard([])} />);
    expect(container.firstChild).toBeNull();
  });

  it('should return null when variables exist but none of them is meant to be shown in the controls menu', () => {
    const variables = [
      new TextBoxVariable({
        name: 'textVar',
        value: 'test',
      }),
    ];
    const { container } = render(<DashboardControlsButton dashboard={getDashboard(variables)} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render a dropdown with a toolbar-button when there are any variables that are set to be shown under the controls menu', () => {
    const variables = [
      new TextBoxVariable({
        name: 'textVar',
        value: 'test',
        hide: VariableHide.inControlsMenu,
      }),
    ];

    render(<DashboardControlsButton dashboard={getDashboard(variables)} />);

    // Should render the toolbar button
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', DASHBOARD_CONTROLS_MENU_ARIA_LABEL);
    expect(button).toHaveAttribute('title', DASHBOARD_CONTROLS_MENU_TITLE);
  });

  it('should render multiple variables in dropdown menu', async () => {
    const variables = [
      new TextBoxVariable({
        name: 'textVar1',
        value: 'test1',
        hide: VariableHide.inControlsMenu,
      }),
      new TextBoxVariable({
        name: 'textVar2',
        value: 'test2',
        hide: VariableHide.inControlsMenu,
      }),
      new QueryVariable({
        name: 'queryVar',
        query: 'test query',
        hide: VariableHide.inControlsMenu,
      }),
    ];

    render(<DashboardControlsButton dashboard={getDashboard(variables)} />);

    // Should have rendered a dropdown
    expect(screen.getByRole('button')).toBeInTheDocument();

    // Open the dropdown
    await userEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('textVar1')).toBeInTheDocument();
    expect(await screen.findByText('textVar2')).toBeInTheDocument();
    expect(await screen.findByText('queryVar')).toBeInTheDocument();
  });

  it('should filter out variables with hide=VariableHide.inControlsMenu', async () => {
    const variables = [
      new TextBoxVariable({
        name: 'textVar1',
        value: 'test1',
        hide: VariableHide.inControlsMenu,
      }),
      // This should be filtered out
      new TextBoxVariable({
        name: 'textVar2',
        value: 'test2',
      }),
      new CustomVariable({
        name: 'customVar',
        query: 'option1,option2',
        hide: VariableHide.inControlsMenu,
      }),
    ];

    render(<DashboardControlsButton dashboard={getDashboard(variables)} />);

    // Should still render dropdown since we have variables with hide=VariableHide.inControlsMenu
    expect(screen.getByRole('button')).toBeInTheDocument();

    // Open the dropdown
    await userEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('textVar1')).toBeInTheDocument();
    expect(await screen.findByText('customVar')).toBeInTheDocument();
    expect(screen.queryByText('textVar2')).not.toBeInTheDocument();
  });
});

describe('DashboardControlsMenu with questions', () => {
  const questions: SceneQuestion[] = [
    { text: 'What stands out?', placement: 'inControlsMenu' },
    { text: 'Why did errors rise?', placement: 'inControlsMenu' },
    { text: 'What changed since yesterday?' },
  ];

  beforeEach(() => {
    jest.mocked(usePluginComponents<ControlProps>).mockReturnValue({ components: [PluginControl], isLoading: false });
  });

  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('counts the questions placed in the menu with the other controls, and shows each as its own control', async () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    const variable = new TextBoxVariable({ name: 'textVar', value: 'test', hide: VariableHide.inControlsMenu });
    render(<DashboardControlsButton dashboard={getDashboard([variable], questions)} />);

    // The question above the dashboard isn't one of them.
    expect(screen.getByRole('button', { name: DASHBOARD_CONTROLS_MENU_ARIA_LABEL })).toHaveTextContent('+ 3');

    await userEvent.click(screen.getByRole('button', { name: DASHBOARD_CONTROLS_MENU_ARIA_LABEL }));

    expect(await screen.findByText('textVar')).toBeInTheDocument();
    // A control per question, so the plugin has no "+N more" menu to open within this one.
    expect(screen.getByRole('button', { name: 'What stands out?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Why did errors rise?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'What changed since yesterday?' })).not.toBeInTheDocument();
  });

  it('offers the menu when only questions are placed in it', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    render(<DashboardControlsButton dashboard={getDashboard([], questions)} />);

    expect(screen.getByRole('button', { name: DASHBOARD_CONTROLS_MENU_ARIA_LABEL })).toHaveTextContent('+ 2');
  });

  it('offers no menu when no question is placed in it', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    const { container } = render(
      <DashboardControlsButton dashboard={getDashboard([], [{ text: 'What changed since yesterday?' }])} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('offers no menu for questions without text', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    const { container } = render(
      <DashboardControlsButton dashboard={getDashboard([], [{ text: ' ', placement: 'inControlsMenu' }])} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('offers no menu while grafana.dashboardQuestions is off', () => {
    setTestFlags({ 'grafana.dashboardQuestions': false });
    const { container } = render(<DashboardControlsButton dashboard={getDashboard([], questions)} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('offers no menu while no plugin adds a control to run the questions', () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    jest.mocked(usePluginComponents<ControlProps>).mockReturnValue({ components: [], isLoading: false });
    const { container } = render(<DashboardControlsButton dashboard={getDashboard([], questions)} />);

    expect(container).toBeEmptyDOMElement();
  });

  // The controls bar is laid out from this check, outside React, before the button says what it has.
  describe('hasDashboardControls', () => {
    it('counts the questions placed in the menu while grafana.dashboardQuestions is on', () => {
      setTestFlags({ 'grafana.dashboardQuestions': true });
      expect(hasDashboardControls(getDashboard([], questions))).toBe(true);
      expect(hasDashboardControls(getDashboard([], [{ text: 'What changed since yesterday?' }]))).toBe(false);
    });

    it('leaves them out while grafana.dashboardQuestions is off', () => {
      setTestFlags({ 'grafana.dashboardQuestions': false });
      expect(hasDashboardControls(getDashboard([], questions))).toBe(false);
    });

    it('leaves them out where the dashboard saves as v1, which drops them', () => {
      setTestFlags({ 'grafana.dashboardQuestions': true });
      expect(hasDashboardControls(getDashboard([], questions, 'v1'))).toBe(false);
    });
  });
});

function getDashboard(
  variables: SceneVariable[],
  questions?: SceneQuestion[],
  serializerVersion: 'v1' | 'v2' = 'v2'
): DashboardScene {
  return new DashboardScene(
    {
      uid: 'test-dashboard',
      title: 'Test Dashboard',
      questions,
      $variables: new SceneVariableSet({
        variables,
      }),
    },
    serializerVersion
  );
}
