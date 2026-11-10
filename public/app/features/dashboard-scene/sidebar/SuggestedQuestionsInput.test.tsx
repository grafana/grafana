import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { SuggestedQuestionsInput } from './SuggestedQuestionsInput';

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneUtils: {
    ...jest.requireActual('@grafana/scenes').sceneUtils,
    registerVariableMacro: jest.fn(),
  },
}));

describe('SuggestedQuestionsInput', () => {
  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('saves one question per line when the field loses focus, and undo brings back the previous questions', async () => {
    const dashboard = setup(['What stands out?']);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('What stands out?');

    fireEvent.focus(input);
    await userEvent.clear(input);
    // Blank lines, surrounding spaces, and a repeated question don't become questions.
    await userEvent.type(input, '  Why did errors rise?  {enter}{enter}Is latency worse?{enter}Why did errors rise?');
    fireEvent.blur(input);

    expect(dashboard.state.questions).toEqual(['Why did errors rise?', 'Is latency worse?']);
    expect(input).toHaveValue('Why did errors rise?\nIs latency worse?');
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);

    act(() => dashboard.state.sidebar.undoAction());

    expect(dashboard.state.questions).toEqual(['What stands out?']);
    expect(input).toHaveValue('What stands out?');
  });

  it('clears the questions when every line is removed, and adds no undo step when nothing changed', async () => {
    const dashboard = setup(['What stands out?']);
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    await userEvent.type(input, '{enter}');
    fireEvent.blur(input);
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);

    fireEvent.focus(input);
    await userEvent.clear(input);
    fireEvent.blur(input);

    expect(dashboard.state.questions).toBeUndefined();
    expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);
  });
});

function setup(questions: string[]) {
  const dashboard = transformSaveModelToScene({
    dashboard: { title: 'Dashboard', uid: 'my-uid', schemaVersion: 30, panels: [], version: 10 },
    meta: {},
  });
  dashboard.setState({ $data: undefined, questions });

  setTestFlags({ dashboardNewLayouts: true });
  activateFullSceneTree(dashboard);
  dashboard.onEnterEditMode();

  render(
    <TestProvider>
      <SuggestedQuestionsInput owner={dashboard} element="dashboard" />
    </TestProvider>
  );

  return dashboard;
}
