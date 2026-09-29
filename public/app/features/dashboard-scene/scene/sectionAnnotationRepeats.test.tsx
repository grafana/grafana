import { act, screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, SceneVariableSet, TestVariable } from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { AnnotationQueryEditorModal } from '../settings/annotations/AnnotationQueryEditorModal';
import { annotationEditActions } from '../settings/annotations/actions';
import { getRepeatSourceObject } from '../utils/clone';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: () => null,
}));

function annotationLayer(name: string) {
  // Disabled so the layer does not query a data source on activation
  return new DashboardAnnotationsDataLayer({
    name,
    isEnabled: false,
    query: { name, enable: false, iconColor: 'red' },
  });
}

function layersOf(section: RowItem | TabItem): DashboardAnnotationsDataLayer[] {
  const set = section.state.$data;
  if (!(set instanceof DashboardDataLayerSet)) {
    throw new Error('Section has no DashboardDataLayerSet');
  }
  return set.state.annotationLayers.filter((l) => l instanceof DashboardAnnotationsDataLayer);
}

function namesOf(section: RowItem | TabItem) {
  return layersOf(section).map((layer) => layer.state.name);
}

function setup(kind: 'row' | 'tab') {
  locationService.replace({ search: '' });

  const sectionState = {
    key: `${kind}-1`,
    title: `${kind} $server`,
    repeatByVariable: 'server',
    $data: new DashboardDataLayerSet({ annotationLayers: [annotationLayer('deploys')] }),
    layout: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
  };
  const section = kind === 'row' ? new RowItem(sectionState) : new TabItem(sectionState);

  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({
      variables: [
        new TestVariable({
          name: 'server',
          query: 'A.*',
          value: ALL_VARIABLE_VALUE,
          text: ALL_VARIABLE_TEXT,
          isMulti: true,
          includeAll: true,
          delayMs: 0,
          optionsToReturn: [
            { label: 'A', value: 'A1' },
            { label: 'B', value: 'B1' },
          ],
        }),
      ],
    }),
    body:
      section instanceof RowItem
        ? new RowsLayoutManager({ rows: [section] })
        : new TabsLayoutManager({ tabs: [section as TabItem] }),
  });

  render(<scene.Component model={scene} />);
  act(() => scene.onEnterEditMode());
  const releaseSidebar = scene.state.sidebar.isActive ? undefined : scene.state.sidebar.activate();

  const getClone = () =>
    section instanceof RowItem ? section.state.repeatedRows?.[0] : (section as TabItem).state.repeatedTabs?.[0];

  return { scene, section, getClone, releaseSidebar };
}

async function renderModal(layer: DashboardAnnotationsDataLayer, onClose: () => void) {
  render(<AnnotationQueryEditorModal layer={layer} onClose={onClose} />);
  // Let the query editor's async data source lookups settle
  await act(async () => {});
}

describe.each(['row', 'tab'] as const)('section annotations in a repeated %s', (kind) => {
  let release: (() => void) | undefined;

  afterEach(() => {
    release?.();
    release = undefined;
  });

  async function setupRepeated() {
    const result = setup(kind);
    release = result.releaseSidebar;
    await waitFor(() => expect(result.getClone()).toBeDefined());
    return { ...result, getClone: () => result.getClone()! };
  }

  it('propagates an annotation added on the source to every repeat', async () => {
    const { section, getClone } = await setupRepeated();
    const sourceSet = section.state.$data as DashboardDataLayerSet;

    act(() => annotationEditActions.addAnnotation({ source: sourceSet, addedObject: annotationLayer('incidents') }));

    expect(namesOf(section)).toEqual(['deploys', 'incidents']);
    expect(namesOf(getClone())).toEqual(['deploys', 'incidents']);
  });

  it('resolves a repeat clone layer to its source so edits from a repeat reach every repeat', async () => {
    const { section, getClone } = await setupRepeated();
    const cloneLayer = layersOf(getClone())[0];
    const sourceLayer = getRepeatSourceObject(cloneLayer);

    expect(sourceLayer).toBe(layersOf(section)[0]);

    act(() =>
      annotationEditActions.removeAnnotation({
        source: sourceLayer.parent as DashboardDataLayerSet,
        removedObject: sourceLayer,
      })
    );

    expect(namesOf(section)).toEqual([]);
    expect(namesOf(getClone())).toEqual([]);
  });

  it('commits query editor changes to every repeat when the modal closes, as one undoable edit', async () => {
    const { scene, section, getClone } = await setupRepeated();
    const sourceLayer = layersOf(section)[0];
    const onClose = jest.fn();

    await renderModal(sourceLayer, onClose);

    // The query editor applies changes to the layer live, without an edit action
    act(() => sourceLayer.setState({ query: { ...sourceLayer.state.query, iconColor: 'blue' } }));
    expect(layersOf(getClone())[0].state.query.iconColor).toBe('red');

    act(() => screen.getByTestId('data-testid Modal close button').click());

    expect(onClose).toHaveBeenCalled();
    expect(layersOf(getClone())[0].state.query.iconColor).toBe('blue');
    expect(scene.state.sidebar.state.undoStack).toHaveLength(1);

    act(() => scene.state.sidebar.undoAction());

    expect(layersOf(section)[0].state.query.iconColor).toBe('red');
    expect(layersOf(getClone())[0].state.query.iconColor).toBe('red');
  });

  it('does not add an edit when the modal closes without changes', async () => {
    const { scene, section } = await setupRepeated();

    const onClose = jest.fn();

    await renderModal(layersOf(section)[0], onClose);
    act(() => screen.getByText('Close').click());

    expect(onClose).toHaveBeenCalled();
    expect(scene.state.sidebar.state.undoStack).toHaveLength(0);
  });
});
