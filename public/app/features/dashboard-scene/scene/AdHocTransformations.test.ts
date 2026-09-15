import { FieldType, LoadingState, getDefaultTimeRange, standardTransformersRegistry, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataNode, SceneDataTransformer, SceneObjectStateChangedEvent, VizPanel } from '@grafana/scenes';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';

import { AD_HOC_ORIGIN, getAdHocTransformations } from './AdHocTransformations';

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

/**
 * Transformations resolve through a promise, so the pipeline settles a microtask after the stage
 * changes. Same for a user transformation edit — nothing specific to ad-hoc.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AdHocTransformations', () => {
  it('contributes nothing while the stage is empty', () => {
    const { panel, transformer, source } = setup();

    expect(getAdHocTransformations(panel)!.get()).toEqual([]);
    expect(transformer.getResolvedSystemTransformations()).toEqual({ prepend: [], append: [] });
    // Passthrough: the pipeline hands on the source frames rather than rebuilding them
    expect(transformer.state.data?.series).toBe(source.state.data!.series);
  });

  it('applies the stage after the user transformations, without joining them', async () => {
    const { panel, transformer } = setup();

    getAdHocTransformations(panel)!.set([HIDE_B]);
    await settle();

    expect(fieldNames(transformer)).toEqual(['A']);
    expect(transformer.state.transformations).toEqual([]);
    expect(transformer.getResolvedSystemTransformations().append).toHaveLength(1);
    expect(transformer.getResolvedSystemTransformations().append[0].origin).toBe(AD_HOC_ORIGIN);
  });

  it('stacks after a user transformation rather than replacing it', async () => {
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

  it('exposes the frames that entered the stage, including a field it removed', async () => {
    const { panel, transformer } = setup();
    const adHoc = getAdHocTransformations(panel)!;

    adHoc.set([HIDE_B]);
    await settle();

    expect(fieldNames(transformer)).toEqual(['A']);
    // The whole point: UI can still offer B back
    expect(adHoc.getSourceSeries()[0].fields.map((f) => f.name)).toEqual(['A', 'B']);
    expect(adHoc.getSourceSeries()[0].fields[1].values).toEqual([4, 5, 6]);
  });

  it('falls back to the pipeline output for the source series while the stage is empty', async () => {
    const { panel, transformer } = setup();
    const adHoc = getAdHocTransformations(panel)!;

    // With no stage the two are the same thing by definition, and nothing is retained
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

  it('holds get() stable between sets, so it is a valid useSyncExternalStore snapshot', () => {
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

    // A fresh closure per resolve makes the transformer report a change on every re-activation
    expect('operator' in first && 'operator' in second && first.operator === second.operator).toBe(true);
  });

  it('publishes no state change the dashboard would treat as persisted', async () => {
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

  it('returns the same instance for a panel, so it is usable as a dependency', () => {
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
