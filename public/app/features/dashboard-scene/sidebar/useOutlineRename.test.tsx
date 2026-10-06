import { act, renderHook } from '@testing-library/react';
import { type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { CustomVariable, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { getEditableElementFor } from '../actions/utils/getEditableElementFor';
import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { useOutlineRename } from './useOutlineRename';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function typeName(onChangeName: (evt: ChangeEvent<HTMLInputElement>) => void, value: string) {
  act(() => onChangeName({ target: { value } } as ChangeEvent<HTMLInputElement>));
}

describe('useOutlineRename', () => {
  let deactivate: () => void;

  afterEach(() => deactivate?.());

  function setup(title = 'Old') {
    const panel = new VizPanel({ key: 'panel-1', title, pluginId: 'table' });
    const dashboard = new DashboardScene({
      isEditing: true,
      $variables: new SceneVariableSet({
        variables: [new CustomVariable({ name: 'host', query: 'server1', value: 'server1', text: 'server1' })],
      }),
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    });
    deactivate = activateFullSceneTree(dashboard);
    const element = getEditableElementFor(panel)!;
    const { result } = renderHook(() => useOutlineRename(panel, element, true));
    act(() => result.current.onNameDoubleClicked({} as MouseEvent));

    return { panel, result, sidebar: dashboard.state.sidebar };
  }

  it('records a committed rename as one undoable action', () => {
    const { panel, result, sidebar } = setup();

    typeName(result.current.onChangeName, 'N');
    typeName(result.current.onChangeName, 'New');
    act(() => result.current.onInputBlur());

    expect(panel.state.title).toBe('New');
    expect(sidebar.state.undoStack).toHaveLength(1);

    sidebar.undoAction();
    expect(panel.state.title).toBe('Old');
  });

  it('does not record a rename that keeps the original name', () => {
    const { result, sidebar } = setup();

    typeName(result.current.onChangeName, 'Old');
    act(() => result.current.onInputBlur());

    expect(sidebar.state.undoStack).toHaveLength(0);
  });

  it('records a rename committed with Enter only once when blur follows', () => {
    const { result, sidebar } = setup();

    typeName(result.current.onChangeName, 'New');
    act(() => result.current.onInputKeyDown({ key: 'Enter' } as KeyboardEvent));
    act(() => result.current.onInputBlur());

    expect(sidebar.state.undoStack).toHaveLength(1);
  });

  it('restores the raw title with variables on undo', () => {
    const { panel, result, sidebar } = setup('CPU $host');

    typeName(result.current.onChangeName, 'CPU server1 total');
    act(() => result.current.onInputBlur());

    sidebar.undoAction();
    expect(panel.state.title).toBe('CPU $host');
  });

  it('keeps the original name when the input is double clicked while renaming', () => {
    const { panel, result, sidebar } = setup();

    typeName(result.current.onChangeName, 'New name');
    act(() => result.current.onNameDoubleClicked({} as MouseEvent));
    typeName(result.current.onChangeName, 'New title');
    act(() => result.current.onInputBlur());

    sidebar.undoAction();
    expect(panel.state.title).toBe('Old');
  });
});
