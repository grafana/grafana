import { renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';

import { VizPanel } from '@grafana/scenes';
import { ElementSelectionContext, type ElementSelectionContextItem } from '@grafana/ui';

import { DashboardScene } from '../DashboardScene';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { useIsMultiSelection, useSelectedObjectsFor, useSelectionCountFor } from './useIsMultiSelection';

function buildTestScene() {
  const panel1 = new VizPanel({ key: 'panel-1', title: 'Panel 1', pluginId: 'timeseries' });
  const panel2 = new VizPanel({ key: 'panel-2', title: 'Panel 2', pluginId: 'timeseries' });
  const scene = new DashboardScene({
    isEditing: true,
    body: DefaultGridLayoutManager.fromVizPanels([panel1, panel2]),
  });

  return { scene, panel1, panel2 };
}

function renderSelectionHook<T>(hook: () => T, selected: ElementSelectionContextItem[]) {
  return renderHook(hook, {
    wrapper: ({ children }: PropsWithChildren) => (
      <ElementSelectionContext.Provider value={{ enabled: true, selected, onSelect: jest.fn(), onClear: jest.fn() }}>
        {children}
      </ElementSelectionContext.Provider>
    ),
  });
}

describe('useIsMultiSelection()', () => {
  test('when more than one element is selected, true is returned', () => {
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];

    const { result } = renderSelectionHook(() => useIsMultiSelection(), selected);

    expect(result.current).toBe(true);
  });

  test('when a single element is selected, false is returned', () => {
    const selected = [{ id: 'panel-1' }];

    const { result } = renderSelectionHook(() => useIsMultiSelection(), selected);

    expect(result.current).toBe(false);
  });

  test('when nothing is selected, false is returned', () => {
    const selected: ElementSelectionContextItem[] = [];

    const { result } = renderSelectionHook(() => useIsMultiSelection(), selected);

    expect(result.current).toBe(false);
  });

  test('when there is no selection context, false is returned', () => {
    const { result } = renderHook(() => useIsMultiSelection());

    expect(result.current).toBe(false);
  });
});

describe('useSelectionCountFor()', () => {
  test('when the given element is part of the selection, the number of selected elements is returned', () => {
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];

    const { result } = renderSelectionHook(() => useSelectionCountFor('panel-1'), selected);

    expect(result.current).toBe(2);
  });

  test('when the given element is not part of the selection, 0 is returned', () => {
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];

    const { result } = renderSelectionHook(() => useSelectionCountFor('panel-3'), selected);

    expect(result.current).toBe(0);
  });

  test('when no element key is given, 0 is returned', () => {
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];

    const { result } = renderSelectionHook(() => useSelectionCountFor(undefined), selected);

    expect(result.current).toBe(0);
  });
});

describe('useSelectedObjectsFor()', () => {
  test('when several elements are selected, their scene objects are returned in selection order', () => {
    const { panel1, panel2 } = buildTestScene();
    const selected = [{ id: 'panel-2' }, { id: 'panel-1' }];

    const { result } = renderSelectionHook(() => useSelectedObjectsFor(panel1), selected);

    expect(result.current.map((obj) => obj.state.key)).toEqual(['panel-2', 'panel-1']);
    expect(result.current[0]).toBe(panel2);
    expect(result.current[1]).toBe(panel1);
  });

  test('when a selected element cannot be found in the scene, it is left out', () => {
    const { panel1 } = buildTestScene();
    const selected = [{ id: 'panel-1' }, { id: 'removed-panel' }];

    const { result } = renderSelectionHook(() => useSelectedObjectsFor(panel1), selected);

    expect(result.current.map((obj) => obj.state.key)).toEqual(['panel-1']);
  });
});
