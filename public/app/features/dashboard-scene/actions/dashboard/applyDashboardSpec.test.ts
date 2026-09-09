import { NewSceneObjectAddedEvent } from '@grafana/scenes';
import {
  defaultPanelKind,
  defaultSpec as defaultDashboardV2Spec,
  type GridLayoutItemKind,
  type PanelKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { type DashboardScene } from '../../scene/DashboardScene';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';

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
    expect(rowsBody).toBeInstanceOf(RowsLayoutManager);
    expect((rowsBody as RowsLayoutManager).state.rows).toHaveLength(2);

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
});
