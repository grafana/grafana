import { NewSceneObjectAddedEvent } from '@grafana/scenes';
import {
  defaultPanelKind,
  defaultSpec as defaultDashboardV2Spec,
  type GridLayoutItemKind,
  type PanelKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardCodePane } from 'app/features/dashboard-scene/sidebar/DashboardCodePane';

import { type DashboardScene } from '../../scene/DashboardScene';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { AddNewPane } from '../../sidebar/add-new/AddNewPane';
import { findVizPanelByKey } from '../../utils/findVizPanel';
import { getEditableElementFor } from '../utils/getEditableElementFor';

import { applyDashboardSpec } from './applyDashboardSpec';

function makeSpec(title: string): DashboardV2Spec {
  return { ...defaultDashboardV2Spec(), title, elements: {} };
}

function makePanel(id: number, title: string): PanelKind {
  return { ...defaultPanelKind(), spec: { ...defaultPanelKind().spec, id, title } };
}

function gridItem(panelName: string): GridLayoutItemKind {
  return {
    kind: 'GridLayoutItem',
    spec: { x: 0, y: 0, width: 12, height: 8, element: { kind: 'ElementReference', name: panelName } },
  };
}

function makeRowsSpec(title: string): DashboardV2Spec {
  return {
    ...defaultDashboardV2Spec(),
    title,
    elements: {
      'panel-1': makePanel(1, 'Panel 1'),
      'panel-2': makePanel(2, 'Panel 2'),
    },
    layout: {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: { title: 'Row 1', layout: { kind: 'GridLayout', spec: { items: [gridItem('panel-1')] } } },
          },
          {
            kind: 'RowsLayoutRow',
            spec: { title: 'Row 2', layout: { kind: 'GridLayout', spec: { items: [gridItem('panel-2')] } } },
          },
        ],
      },
    },
  };
}

function makeTabsSpec(title: string): DashboardV2Spec {
  return {
    ...defaultDashboardV2Spec(),
    title,
    elements: {
      'panel-1': makePanel(1, 'Panel 1'),
      'panel-2': makePanel(2, 'Panel 2'),
    },
    layout: {
      kind: 'TabsLayout',
      spec: {
        tabs: [
          {
            kind: 'TabsLayoutTab',
            spec: { title: 'Tab 1', layout: { kind: 'GridLayout', spec: { items: [gridItem('panel-1')] } } },
          },
          {
            kind: 'TabsLayoutTab',
            spec: { title: 'Tab 2', layout: { kind: 'GridLayout', spec: { items: [gridItem('panel-2')] } } },
          },
        ],
      },
    },
  };
}

function buildScene(spec: DashboardV2Spec): DashboardScene {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal resource envelope for the test
  const dto = {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: { name: 'dash-1', generation: 1, creationTimestamp: '2026-08-03T00:00:00Z', annotations: {} },
    access: { canEdit: true, canSave: true, canShare: true, canStar: true, canDelete: true, canAdmin: true },
    spec,
  } as unknown as DashboardWithAccessInfo<DashboardV2Spec>;

  const scene = transformSaveModelSchemaV2ToScene(dto);
  scene.state.sidebar.activate();
  scene.setState({ isEditing: true });
  return scene;
}

describe('applyDashboardSpec', () => {
  it('preserves the sidebar instance across the rebuild, so its undo/redo stack survives', () => {
    const scene = buildScene(makeSpec('Old title'));
    const originalSidebar = scene.state.sidebar;

    applyDashboardSpec({ scene, spec: makeSpec('New title'), description: 'Apply spec' });

    expect(scene.state.sidebar).toBe(originalSidebar);
  });

  it('applies the spec, and undo/redo toggle between the old and new scene', () => {
    const scene = buildScene(makeSpec('Old title'));
    const originalBody = scene.state.body;

    applyDashboardSpec({ scene, spec: makeSpec('New title'), description: 'Apply spec' });

    expect(scene.state.title).toBe('New title');
    const newBody = scene.state.body;
    expect(newBody).not.toBe(originalBody);

    scene.state.sidebar.undoAction();
    expect(scene.state.title).toBe('Old title');
    expect(scene.state.body).toBe(originalBody);

    scene.state.sidebar.redoAction();
    expect(scene.state.title).toBe('New title');
    expect(scene.state.body).toBe(newBody);

    scene.state.sidebar.undoAction();
    scene.state.sidebar.redoAction();
    expect(scene.state.title).toBe('New title');
    expect(scene.state.body).toBe(newBody);
  });

  it('re-publishes NewSceneObjectAddedEvent for the restored children on undo, so url sync re-attaches', () => {
    const scene = buildScene(makeSpec('Old title'));
    const originalBody = scene.state.body;

    applyDashboardSpec({ scene, spec: makeSpec('New title'), description: 'Apply spec' });

    const addedObjects: unknown[] = [];
    scene.subscribeToEvent(NewSceneObjectAddedEvent, (evt) => addedObjects.push(evt.payload));

    scene.state.sidebar.undoAction();

    expect(addedObjects).toContain(originalBody);
  });

  it('marks the scene dirty on perform, and restores the prior dirty state on undo', () => {
    const scene = buildScene(makeSpec('Old title'));
    expect(scene.state.isDirty).toBeFalsy();

    applyDashboardSpec({ scene, spec: makeSpec('New title'), description: 'Apply spec' });
    expect(scene.state.isDirty).toBe(true);

    scene.state.sidebar.undoAction();
    expect(scene.state.isDirty).toBeFalsy();
  });

  it('changes panels in rows to tabs, and undo/redo restore each layout', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));
    const rowsBody = scene.state.body;

    applyDashboardSpec({ scene, spec: makeTabsSpec('Dashboard'), description: 'Apply spec' });

    const tabsBody = scene.state.body;
    expect(tabsBody).not.toBe(rowsBody);
    expect(tabsBody).toBeInstanceOf(TabsLayoutManager);
    expect((tabsBody as TabsLayoutManager).state.tabs).toHaveLength(2);

    scene.state.sidebar.undoAction();
    expect(scene.state.body).toBe(rowsBody);
    expect(scene.state.body).toBeInstanceOf(RowsLayoutManager);

    scene.state.sidebar.redoAction();
    expect(scene.state.body).toBe(tabsBody);
    expect(scene.state.body).toBeInstanceOf(TabsLayoutManager);
  });

  it('recreates the code pane on apply, undo, and redo so it reloads the current spec', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));

    scene.state.sidebar.openPane(new DashboardCodePane({}));
    const originalPane = scene.state.sidebar.state.openPane!;
    expect(originalPane.getId()).toBe('code');

    applyDashboardSpec({ scene, spec: makeRowsSpec('Dashboard'), description: 'Apply spec' });

    const appliedPane = scene.state.sidebar.state.openPane!;
    expect(appliedPane.getId()).toBe('code');
    expect(appliedPane.state.key).not.toBe(originalPane.state.key);

    scene.state.sidebar.undoAction();
    const restoredPane = scene.state.sidebar.state.openPane!;
    expect(restoredPane.getId()).toBe('code');
    expect(restoredPane.state.key).not.toBe(appliedPane.state.key);

    scene.state.sidebar.redoAction();
    expect(scene.state.sidebar.state.openPane?.getId()).toBe('code');
    expect(scene.state.sidebar.state.openPane?.state.key).not.toBe(restoredPane.state.key);
  });

  it('closes an open pane even when there is no selection', () => {
    const scene = buildScene(makeSpec('Old title'));
    const addNewPane = new AddNewPane({});
    scene.state.sidebar.openPane(addNewPane);
    expect(scene.state.sidebar.state.openPane).toBe(addNewPane);
    expect(scene.state.sidebar.state.selectionContext.selected).toHaveLength(0);

    applyDashboardSpec({ scene, spec: makeSpec('New title'), description: 'Apply spec' });

    expect(scene.state.sidebar.state.openPane).toBeUndefined();
  });

  it('rebinds panel selection by ID across layouts on apply, undo, and redo', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));
    const sidebar = scene.state.sidebar;
    sidebar.selectObject(findVizPanelByKey(scene, 'panel-1')!);
    const originalSelection = sidebar.state.selectionContext.selected;
    const originalPane = sidebar.state.openPane!;
    const originalPanel = sidebar.getSelectedObject();

    applyDashboardSpec({ scene, spec: makeTabsSpec('Dashboard'), description: 'Apply spec' });

    const appliedPanel = findVizPanelByKey(scene, 'panel-1')!;
    expect(sidebar.state.selectionContext.selected).toEqual([{ id: 'panel-1' }]);
    expect(sidebar.state.selectionContext.selected).not.toBe(originalSelection);
    expect(sidebar.state.openPane?.getId()).toBe('element');
    expect(sidebar.state.openPane?.state.key).not.toBe(originalPane.state.key);
    expect(sidebar.getSelectedObject() === appliedPanel).toBe(true);
    expect(sidebar.getSelectedObject() === originalPanel).toBe(false);
    expect(sidebar.state.previousState).toBeUndefined();

    sidebar.undoAction();
    expect(sidebar.getSelectedObject() === originalPanel).toBe(true);
    expect(sidebar.state.openPane?.getId()).toBe('element');

    sidebar.redoAction();
    expect(sidebar.getSelectedObject() === appliedPanel).toBe(true);
    expect(sidebar.state.openPane?.getId()).toBe('element');
  });

  it('closes the pane when a selected ID no longer exists', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));
    const sidebar = scene.state.sidebar;
    sidebar.selectObject(findVizPanelByKey(scene, 'panel-1')!);
    expect(sidebar.state.openPane?.getId()).toBe('element');

    applyDashboardSpec({ scene, spec: makeSpec('Empty dashboard'), description: 'Apply spec' });

    expect(sidebar.state.selectionContext.selected).toEqual([]);
    expect(sidebar.state.openPane).toBeUndefined();
    expect(sidebar.state.previousState).toBeUndefined();
  });

  it('keeps title edits on the reselected panel in the serialized dashboard', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));
    const sidebar = scene.state.sidebar;
    const originalPanel = findVizPanelByKey(scene, 'panel-1')!;
    sidebar.selectObject(originalPanel);

    applyDashboardSpec({ scene, spec: makeTabsSpec('Dashboard'), description: 'Apply spec' });
    getEditableElementFor(sidebar.getSelectedObject())!.onChangeName!('Renamed after rebuild');

    expect(transformSceneToSaveModelSchemaV2(scene).elements['panel-1']).toMatchObject({
      spec: { title: 'Renamed after rebuild' },
    });
    expect(originalPanel.state.title).toBe('Panel 1');
  });

  it('preserves multiple selected IDs and closes the pane if any selected panel is removed', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));
    const sidebar = scene.state.sidebar;
    sidebar.selectObject(findVizPanelByKey(scene, 'panel-1')!);
    sidebar.selectObject(findVizPanelByKey(scene, 'panel-2')!, { multi: true });

    applyDashboardSpec({ scene, spec: makeTabsSpec('Dashboard'), description: 'Apply spec' });
    expect(sidebar.state.selectionContext.selected).toEqual([{ id: 'panel-1' }, { id: 'panel-2' }]);
    expect(sidebar.state.openPane?.getId()).toBe('element');

    const spec = makeRowsSpec('Dashboard');
    delete spec.elements['panel-2'];
    spec.layout = { kind: 'GridLayout', spec: { items: [gridItem('panel-1')] } };
    sidebar.setState({ isDocked: true });
    applyDashboardSpec({ scene, spec, description: 'Remove panel' });

    expect(sidebar.state.selectionContext.selected).toEqual([]);
    expect(sidebar.state.openPane).toBeUndefined();
  });
});
