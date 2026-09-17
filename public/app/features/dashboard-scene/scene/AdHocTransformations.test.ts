import { FieldType, LoadingState, getDefaultTimeRange, standardTransformersRegistry, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataNode, SceneDataTransformer, SceneObjectStateChangedEvent, VizPanel } from '@grafana/scenes';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';

import { createAdHocTransformations } from './AdHocTransformations';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: (id: string) => getPanelPlugin({ id }),
});

standardTransformersRegistry.setInit(getStandardTransformers);

const HIDE_B = { id: 'organize', options: { excludeByName: { B: true } } };
const REVERSE_FIELDS = { id: 'organize', options: { indexByName: { B: 0, A: 1 } } };
const TAG = 'test:hidden-fields';
const OTHER_TAG = 'test:field-order';

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
  const adHoc = createAdHocTransformations(panel)!;

  transformer.activate();

  return { adHoc, panel, transformer, source };
}

const fieldNames = (transformer: SceneDataTransformer) => transformer.state.data?.series[0].fields.map((f) => f.name);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AdHocTransformations', () => {
  it('contributes nothing while the stage is empty', () => {
    const { adHoc, transformer, source } = setup();

    expect(adHoc.get(TAG)).toEqual([]);
    expect(transformer.getResolvedSystemTransformations()).toEqual({ prepend: [], append: [] });
    expect(transformer.state.data?.series).toBe(source.state.data!.series);
  });

  it('keeps ad-hoc configs separate from saved transformations and source execution', async () => {
    const { adHoc, transformer, source } = setup();
    const sourceListener = jest.fn();
    source.subscribeToState(sourceListener);

    adHoc.set(TAG, [HIDE_B]);
    await settle();

    expect(fieldNames(transformer)).toEqual(['A']);
    expect(transformer.state.transformations).toEqual([]);
    expect(transformer.getResolvedSystemTransformations().append).toEqual([
      expect.objectContaining({ origin: TAG, position: 'append', tag: TAG, operator: expect.any(Function) }),
    ]);
    expect(sourceListener).not.toHaveBeenCalled();
  });

  it('applies ad-hoc transformations after saved transformations', async () => {
    const { adHoc, transformer } = setup();

    transformer.setState({ transformations: [REVERSE_FIELDS] });
    transformer.reprocessTransformations();
    await settle();

    expect(fieldNames(transformer)).toEqual(['B', 'A']);

    adHoc.set(TAG, [HIDE_B]);
    await settle();

    expect(fieldNames(transformer)).toEqual(['A']);
    expect(transformer.state.transformations).toHaveLength(1);
  });

  it('exposes source frames with fields removed by the stage', async () => {
    const { adHoc, transformer } = setup();

    adHoc.set(TAG, [HIDE_B]);
    await settle();

    expect(fieldNames(transformer)).toEqual(['A']);
    expect(adHoc.getSourceSeries(TAG)[0].fields.map((f) => f.name)).toEqual(['A', 'B']);
    expect(adHoc.getSourceSeries(TAG)[0].fields[1].values).toEqual([4, 5, 6]);
  });

  it('retains previous field values while a runtime group is active', () => {
    const { adHoc, panel } = setup();
    panel.setState({ _UNSAFE_clearPreviousFieldValues: true });

    adHoc.set(TAG, [HIDE_B]);

    expect(panel.state._UNSAFE_clearPreviousFieldValues).toBe(false);
  });

  it('returns the pipeline output as source series while empty', async () => {
    const { adHoc, transformer } = setup();

    expect(adHoc.getSourceSeries(TAG)).toBe(transformer.state.data!.series);

    adHoc.set(TAG, [HIDE_B]);
    await settle();
    adHoc.set(TAG, []);
    await settle();

    expect(adHoc.getSourceSeries(TAG)[0].fields.map((f) => f.name)).toEqual(['A', 'B']);
  });

  it('notifies subscribers and stops when they unsubscribe', () => {
    const { adHoc } = setup();
    const onChange = jest.fn();

    const unsubscribe = adHoc.subscribe(TAG, onChange);
    adHoc.set(TAG, [HIDE_B]);

    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    adHoc.set(TAG, []);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('returns a stable snapshot between updates', () => {
    const { adHoc } = setup();

    expect(adHoc.get(TAG)).toBe(adHoc.get(TAG));

    adHoc.set(TAG, [HIDE_B]);
    const afterSet = adHoc.get(TAG);

    expect(adHoc.get(TAG)).toBe(afterSet);
  });

  it('resolves the same operator instance while the configs are unchanged', async () => {
    const { adHoc, transformer } = setup();

    adHoc.set(TAG, [HIDE_B]);
    await settle();

    const first = transformer.getResolvedSystemTransformations().append[0];
    transformer.reprocessTransformations();
    const second = transformer.getResolvedSystemTransformations().append[0];

    expect('operator' in first && 'operator' in second && first.operator === second.operator).toBe(true);
  });

  it('keeps the operator instance stable when the configs change', async () => {
    const { adHoc, transformer } = setup();

    adHoc.set(TAG, [HIDE_B]);
    await settle();
    const first = transformer.getResolvedSystemTransformations().append[0];

    adHoc.set(TAG, []);
    adHoc.set(TAG, [HIDE_B]);
    await settle();
    const second = transformer.getResolvedSystemTransformations().append[0];

    expect('operator' in first && 'operator' in second && first.operator === second.operator).toBe(true);
  });

  it('does not mark dashboard state as changed', async () => {
    const { adHoc, panel } = setup();
    const events: SceneObjectStateChangedEvent[] = [];

    panel.subscribeToEvent(SceneObjectStateChangedEvent, (event) => events.push(event));

    adHoc.set(TAG, [HIDE_B]);
    await settle();

    expect(events.length).toBeGreaterThan(0);
    expect(events.filter((event) => DashboardSceneChangeTracker.isUpdatingPersistedState(event))).toEqual([]);
  });

  it('clears the stage when the panel changes viz type', () => {
    const { adHoc, panel } = setup();

    adHoc.set(TAG, [HIDE_B]);
    panel.setState({ pluginId: 'timeseries' });

    expect(adHoc.get(TAG)).toEqual([]);
  });

  it('updates tags independently and preserves registration order', async () => {
    const { adHoc, transformer } = setup();
    const firstListener = jest.fn();
    const secondListener = jest.fn();

    adHoc.subscribe(TAG, firstListener);
    adHoc.subscribe(OTHER_TAG, secondListener);
    adHoc.set(OTHER_TAG, [REVERSE_FIELDS]);
    adHoc.set(TAG, [HIDE_B]);
    await settle();

    expect(fieldNames(transformer)).toEqual(['A']);
    expect(adHoc.get(OTHER_TAG)).toEqual([REVERSE_FIELDS]);
    expect(adHoc.get(TAG)).toEqual([HIDE_B]);
    expect(transformer.getResolvedSystemTransformations().append.map(({ tag }) => tag)).toEqual([OTHER_TAG, TAG]);
    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);

    adHoc.set(TAG, []);
    await settle();

    expect(fieldNames(transformer)).toEqual(['B', 'A']);
    expect(adHoc.get(OTHER_TAG)).toEqual([REVERSE_FIELDS]);
    expect(transformer.getResolvedSystemTransformations().append.map(({ tag }) => tag)).toEqual([OTHER_TAG]);
    expect(firstListener).toHaveBeenCalledTimes(2);
    expect(secondListener).toHaveBeenCalledTimes(1);
  });

  it('moves active tags when panel data is replaced', async () => {
    const { adHoc, panel, transformer } = setup();
    adHoc.set(TAG, [HIDE_B]);
    await settle();

    const replacementSource = new SceneDataNode({
      data: {
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
        series: [
          toDataFrame({
            fields: [
              { name: 'A', values: [1] },
              { name: 'B', values: [2] },
            ],
          }),
        ],
      },
    });
    const replacement = new SceneDataTransformer({ $data: replacementSource, transformations: [] });

    panel.setState({ $data: replacement });
    replacement.activate();
    await settle();

    expect(transformer.getResolvedSystemTransformations().append).toEqual([]);
    expect(replacement.getResolvedSystemTransformations().append.map(({ tag }) => tag)).toEqual([TAG]);
    expect(fieldNames(replacement)).toEqual(['A']);

    adHoc.set(TAG, []);
    await settle();

    expect(replacement.getResolvedSystemTransformations().append).toEqual([]);
    expect(fieldNames(replacement)).toEqual(['A', 'B']);
  });

  it('clears every active tag when the panel changes viz type', async () => {
    const { adHoc, panel, transformer } = setup();
    const firstListener = jest.fn();
    const secondListener = jest.fn();

    adHoc.subscribe(TAG, firstListener);
    adHoc.subscribe(OTHER_TAG, secondListener);
    adHoc.set(TAG, [HIDE_B]);
    adHoc.set(OTHER_TAG, [REVERSE_FIELDS]);
    panel.setState({ pluginId: 'timeseries' });
    await settle();

    expect(adHoc.get(TAG)).toEqual([]);
    expect(adHoc.get(OTHER_TAG)).toEqual([]);
    expect(transformer.getResolvedSystemTransformations().append).toEqual([]);
    expect(firstListener).toHaveBeenCalledTimes(2);
    expect(secondListener).toHaveBeenCalledTimes(2);
  });
});

describe('AdHocTransformations support', () => {
  it('does not support a panel with no transformation stage', () => {
    const panel = new VizPanel({ pluginId: 'text' });

    expect(createAdHocTransformations(panel)).toBeUndefined();
  });

  it('gives a clone its own empty stage', () => {
    const { adHoc, panel } = setup();

    adHoc.set(TAG, [HIDE_B]);

    const clone = panel.clone();
    clone.activate();
    const cloneAdHoc = createAdHocTransformations(clone)!;

    expect(cloneAdHoc.get(TAG)).toEqual([]);
    expect((clone.state.$data as SceneDataTransformer).getResolvedSystemTransformations().append).toEqual([]);
    expect(adHoc.get(TAG)).toHaveLength(1);
  });

  it('becomes available after a transformation stage is installed late', () => {
    const panel = new VizPanel({ pluginId: 'table' });
    expect(createAdHocTransformations(panel)).toBeUndefined();

    panel.setState({ $data: new SceneDataTransformer({ transformations: [] }) });

    expect(createAdHocTransformations(panel)).toBeDefined();
  });
});
