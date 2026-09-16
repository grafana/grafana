import { FieldType, LoadingState, getDefaultTimeRange, standardTransformersRegistry, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataNode, SceneDataTransformer, SceneObjectStateChangedEvent, VizPanel } from '@grafana/scenes';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';

import { getAdHocTransformations } from './AdHocTransformations';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: (id: string) => getPanelPlugin({ id }),
});

standardTransformersRegistry.setInit(getStandardTransformers);

const HIDE_B = { id: 'organize', options: { excludeByName: { B: true } } };

function setup() {
  const source = new SceneDataNode({
    data: {
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
      series: [
        toDataFrame({
          fields: [
            { name: 'A', type: FieldType.number, values: [1, 2, 3] },
            { name: 'B', type: FieldType.number, values: [4, 5, 6] },
          ],
        }),
      ],
    },
  });

  const transformer = new SceneDataTransformer({ $data: source, transformations: [] });
  const panel = new VizPanel({ pluginId: 'table', $data: transformer });

  transformer.activate();

  return { panel, transformer, source };
}

const fieldNames = (transformer: SceneDataTransformer) => transformer.state.data?.series[0].fields.map((f) => f.name);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AdHocTransformations', () => {
  it('contributes nothing while the stage is empty', () => {
    const { panel, transformer, source } = setup();

    expect(getAdHocTransformations(panel)!.get()).toEqual([]);
    expect(transformer.getResolvedSystemTransformations()).toEqual({ prepend: [], append: [] });
    expect(transformer.state.data?.series).toBe(source.state.data!.series);
  });

  it('keeps ad-hoc configs separate from saved transformations', async () => {
    const { panel, transformer } = setup();

    getAdHocTransformations(panel)!.set([HIDE_B]);
    await settle();

    expect(fieldNames(transformer)).toEqual(['A']);
    expect(transformer.state.transformations).toEqual([]);
    expect(transformer.getResolvedSystemTransformations().append).toHaveLength(1);
  });

  it('applies ad-hoc transformations after saved transformations', async () => {
    const { panel, transformer } = setup();

    transformer.setState({ transformations: [{ id: 'organize', options: { indexByName: { B: 0, A: 1 } } }] });
    transformer.reprocessTransformations();
    await settle();

    expect(fieldNames(transformer)).toEqual(['B', 'A']);

    getAdHocTransformations(panel)!.set([HIDE_B]);
    await settle();

    expect(fieldNames(transformer)).toEqual(['A']);
    expect(transformer.state.transformations).toHaveLength(1);
  });

  it('exposes source frames with fields removed by the stage', async () => {
    const { panel, transformer } = setup();
    const adHoc = getAdHocTransformations(panel)!;

    adHoc.set([HIDE_B]);
    await settle();

    expect(fieldNames(transformer)).toEqual(['A']);
    expect(adHoc.getSourceSeries()[0].fields.map((f) => f.name)).toEqual(['A', 'B']);
    expect(adHoc.getSourceSeries()[0].fields[1].values).toEqual([4, 5, 6]);
  });

  it('returns the pipeline output as source series while empty', async () => {
    const { panel, transformer } = setup();
    const adHoc = getAdHocTransformations(panel)!;

    expect(adHoc.getSourceSeries()).toBe(transformer.state.data!.series);

    adHoc.set([HIDE_B]);
    await settle();
    adHoc.set([]);
    await settle();

    expect(adHoc.getSourceSeries()[0].fields.map((f) => f.name)).toEqual(['A', 'B']);
  });

  it('notifies subscribers and stops when they unsubscribe', () => {
    const { panel } = setup();
    const adHoc = getAdHocTransformations(panel)!;
    const onChange = jest.fn();

    const unsubscribe = adHoc.subscribe(onChange);
    adHoc.set([HIDE_B]);

    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    adHoc.set([]);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('returns a stable snapshot between updates', () => {
    const { panel } = setup();
    const adHoc = getAdHocTransformations(panel)!;

    expect(adHoc.get()).toBe(adHoc.get());

    adHoc.set([HIDE_B]);
    const afterSet = adHoc.get();

    expect(adHoc.get()).toBe(afterSet);
  });

  it('resolves the same operator instance while the configs are unchanged', async () => {
    const { panel, transformer } = setup();

    getAdHocTransformations(panel)!.set([HIDE_B]);
    await settle();

    const first = transformer.getResolvedSystemTransformations().append[0];
    transformer.reprocessTransformations();
    const second = transformer.getResolvedSystemTransformations().append[0];

    expect('operator' in first && 'operator' in second && first.operator === second.operator).toBe(true);
  });

  it('replaces the operator instance when the configs change', async () => {
    const { panel, transformer } = setup();
    const adHoc = getAdHocTransformations(panel)!;

    adHoc.set([HIDE_B]);
    await settle();
    const first = transformer.getResolvedSystemTransformations().append[0];

    adHoc.set([]);
    adHoc.set([HIDE_B]);
    await settle();
    const second = transformer.getResolvedSystemTransformations().append[0];

    expect('operator' in first && 'operator' in second && first.operator !== second.operator).toBe(true);
  });

  it('does not mark dashboard state as changed', async () => {
    const { panel } = setup();
    const events: SceneObjectStateChangedEvent[] = [];

    panel.subscribeToEvent(SceneObjectStateChangedEvent, (event) => events.push(event));

    getAdHocTransformations(panel)!.set([HIDE_B]);
    await settle();

    expect(events.length).toBeGreaterThan(0);
    expect(events.filter((event) => DashboardSceneChangeTracker.isUpdatingPersistedState(event))).toEqual([]);
  });

  it('clears the stage when the panel changes viz type', () => {
    const { panel } = setup();
    const adHoc = getAdHocTransformations(panel)!;

    adHoc.set([HIDE_B]);
    panel.setState({ pluginId: 'timeseries' });

    expect(adHoc.get()).toEqual([]);
  });
});

describe('getAdHocTransformations', () => {
  it('returns undefined for a panel with no transformation stage', () => {
    const panel = new VizPanel({ pluginId: 'text' });

    expect(getAdHocTransformations(panel)).toBeUndefined();
  });

  it('returns the same instance for repeated panel lookups', () => {
    const { panel } = setup();

    expect(getAdHocTransformations(panel)).toBe(getAdHocTransformations(panel));
  });

  it('gives a clone its own empty stage', () => {
    const { panel } = setup();

    getAdHocTransformations(panel)!.set([HIDE_B]);

    const clone = panel.clone();
    clone.activate();

    expect(getAdHocTransformations(clone)!.get()).toEqual([]);
    expect(getAdHocTransformations(panel)!.get()).toHaveLength(1);
  });
});
