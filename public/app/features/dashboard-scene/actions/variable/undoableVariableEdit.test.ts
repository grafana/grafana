import { SceneVariableSet, TextBoxVariable } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { undoableVariableEdit } from './undoableVariableEdit';

function setup() {
  const variable = new TextBoxVariable({ name: 'text', value: 'old' });
  const dashboard = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [variable] }),
    isEditing: true,
    body: AutoGridLayoutManager.createEmpty(),
  });
  activateFullSceneTree(dashboard);

  const changeValue = (shouldRecord: boolean) =>
    undoableVariableEdit(shouldRecord, {
      meta: { actionId: 'variable.changeValue' },
      source: variable,
      description: 'Change value',
      perform: () => variable.setState({ value: 'new' }),
      undo: () => variable.setState({ value: 'old' }),
    });

  return { variable, sidebar: dashboard.state.sidebar, changeValue };
}

describe('undoableVariableEdit', () => {
  it('records the change so it can be undone and redone', () => {
    const { variable, sidebar, changeValue } = setup();

    changeValue(true);
    expect(variable.state.value).toBe('new');
    expect(sidebar.state.undoStack).toHaveLength(1);

    sidebar.undoAction();
    expect(variable.state.value).toBe('old');

    sidebar.redoAction();
    expect(variable.state.value).toBe('new');
  });

  it('applies the change without recording it when recording is not requested', () => {
    const { variable, sidebar, changeValue } = setup();

    changeValue(false);

    expect(variable.state.value).toBe('new');
    expect(sidebar.state.undoStack).toHaveLength(0);
  });
});
