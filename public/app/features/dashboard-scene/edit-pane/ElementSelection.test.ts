import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { DashboardEditableElement } from './DashboardEditableElement';
import { ElementSelection } from './ElementSelection';
import { MultiSelectedObjectsEditableElement } from './MultiSelectedObjectsEditableElement';
import { MultiSelectedVizPanelsEditableElement } from './MultiSelectedVizPanelsEditableElement';
import { VizPanelEditableElement } from './VizPanelEditableElement';

let panel1: VizPanel, panel2: VizPanel, scene: DashboardScene;

describe('ElementSelection', () => {
  beforeAll(() => {
    const testScene = buildScene();

    panel1 = testScene.panel1;
    panel2 = testScene.panel2;
    scene = testScene.scene;
  });

  it('returns a single object when only one is selected', () => {
    const selection = new ElementSelection([['id1', panel1.getRef()]]);

    expect(selection.isMultiSelection).toBe(false);
    expect(selection.getSelection()).toBe(panel1);
  });

  it('returns multiple objects when multiple are selected', () => {
    const selection = new ElementSelection([
      ['id1', panel1.getRef()],
      ['id2', panel2.getRef()],
    ]);

    expect(selection.isMultiSelection).toBe(true);
    expect(selection.getSelection()).toEqual([panel1, panel2]);
  });

  it('delete element', () => {
    const selection = new ElementSelection([
      ['id1', panel1.getRef()],
      ['id2', panel2.getRef()],
    ]);

    selection.removeValue('id1');
    expect(selection.isMultiSelection).toBe(false);
    expect(selection.getSelection()).toEqual(panel2);
  });

  it('returns entries', () => {
    const ref1 = panel1.getRef();
    const ref2 = panel2.getRef();

    const selection = new ElementSelection([
      ['id1', ref1],
      ['id2', ref2],
    ]);

    expect(selection.isMultiSelection).toBe(true);
    expect(selection.getSelectionEntries()).toEqual([
      ['id1', ref1],
      ['id2', ref2],
    ]);
  });

  it('returns the first selected object through getFirstObject', () => {
    const selection = new ElementSelection([
      ['id1', panel1.getRef()],
      ['id2', panel2.getRef()],
    ]);

    expect(selection.isMultiSelection).toBe(true);
    expect(selection.getFirstObject()).toBe(panel1);
  });

  it('creates correct element type for single selection', () => {
    const vizSelection = new ElementSelection([['id1', panel1.getRef()]]);
    expect(vizSelection.createSelectionElement()).toBeInstanceOf(VizPanelEditableElement);

    const dashboardSelection = new ElementSelection([['id1', scene.getRef()]]);
    expect(dashboardSelection.createSelectionElement()).toBeInstanceOf(DashboardEditableElement);
  });

  it('creates correct element type for multi-selection of same type', () => {
    const selection = new ElementSelection([
      ['id1', panel1.getRef()],
      ['id2', panel2.getRef()],
    ]);

    expect(selection.createSelectionElement()).toBeInstanceOf(MultiSelectedVizPanelsEditableElement);
  });

  it('creates MultiSelectedObjectsEditableElement for selection of different object types', () => {
    const selection = new ElementSelection([
      ['id1', panel1.getRef()],
      ['id2', scene.getRef()],
    ]);

    expect(selection.createSelectionElement()).toBeInstanceOf(MultiSelectedObjectsEditableElement);
  });

  it('handles empty selection correctly', () => {
    const selection = new ElementSelection([]);
    expect(selection.getSelection()).toBeUndefined();
    expect(selection.getFirstObject()).toBeUndefined();
    expect(selection.createSelectionElement()).toBeUndefined();
  });

  it('returns the entries with the specified value removed', () => {
    const selection = new ElementSelection([
      ['id1', panel1.getRef()],
      ['id2', panel2.getRef()],
      ['id3', scene.getRef()],
    ]);

    const { entries, contextItems } = selection.getStateWithoutValueAt('id2');
    expect(entries).toEqual([
      ['id1', panel1.getRef()],
      ['id3', scene.getRef()],
    ]);
    expect(contextItems).toEqual([{ id: 'id1' }, { id: 'id3' }]);
  });

  it('returns the entries with the specified value added in a multi-select scenario', () => {
    const selection = new ElementSelection([
      ['id1', panel1.getRef()],
      ['id2', panel2.getRef()],
    ]);

    const { selection: entries, contextItems } = selection.getStateWithValue('id3', scene, true);

    expect(entries).toEqual([
      ['id3', panel1.getRef()],
      ['id1', panel2.getRef()],
      ['id2', scene.getRef()],
    ]);
    expect(contextItems).toEqual([{ id: 'id3' }, { id: 'id1' }, { id: 'id2' }]);
  });

  it('returns the entries with just the specified value added in a non multi-select scenario', () => {
    const selection = new ElementSelection([
      ['id1', panel1.getRef()],
      ['id2', panel2.getRef()],
    ]);

    const { selection: entries, contextItems } = selection.getStateWithValue('id3', scene, false);

    expect(entries).toEqual([['id3', scene.getRef()]]);
    expect(contextItems).toEqual([{ id: 'id3' }]);
  });
});

function buildScene() {
  const panel1 = new VizPanel({
    title: 'Panel A',
    // pluginId: 'text',
    key: 'panel-12',
  });

  const panel2 = new VizPanel({
    title: 'Panel B',
    // pluginId: 'text',
    key: 'panel-13',
  });

  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    $timeRange: new SceneTimeRange({}),
    body: DefaultGridLayoutManager.fromVizPanels([panel1, panel2]),
  });

  return { panel1, panel2, scene };
}
