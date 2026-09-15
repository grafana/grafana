import { act, render } from 'test/test-utils';

import {
  type DataFrame,
  FieldType,
  LoadingState,
  type PanelProps,
  getDefaultTimeRange,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  type ContributedTransformation,
  SceneDataNode,
  SceneDataTransformer,
  SceneTimeRange,
  VizPanel,
} from '@grafana/scenes';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

/** Every series array the panel component was handed, in render order. */
const renderedSeries: DataFrame[][] = [];

function RecordingPanel({ data }: PanelProps) {
  renderedSeries.push(data.series);
  return <div data-testid="panel">{data.series[0]?.fields.map((f) => f.name).join(',')}</div>;
}

const plugin = getPanelPlugin({ id: 'test-panel' }, RecordingPanel);

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(plugin),
  getPanelPluginFromCache: () => plugin,
});

// jsdom measures everything as 0x0, and VizPanelRenderer renders nothing without a size.
jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useMeasure: () => [() => {}, { width: 500, height: 500 }],
}));

standardTransformersRegistry.setInit(getStandardTransformers);

const HIDE_B = { id: 'organize', options: { excludeByName: { B: true } } };

/**
 * Every dashboard panel is built with scenes' `_UNSAFE_clearPreviousFieldValues`, which truncates in
 * place (`vals.length = 0`) any `field.values` array that was in the previous render but not the
 * current one. Transformations pass field objects through by reference, so a transformation that
 * drops a field hands that field's array — the query runner's array — to the truncation. Removing
 * and re-adding such a transformation therefore loses the data unless something refetches in between.
 *
 * Ad-hoc transformations hide and show a field without refetching, so this is the exact interaction
 * they hit. They reach the pipeline as a *system* transformation tier, which scenes exempts from the
 * clearing; the user-transformation path is left as it was.
 *
 * The assertions are ordered so a pass cannot be vacuous: the panel must be shown to have really
 * re-rendered with each series before the values are examined.
 */
describe('_UNSAFE_clearPreviousFieldValues vs. a field removed by a transformation', () => {
  beforeEach(() => {
    renderedSeries.length = 0;
  });

  function setup() {
    const sourceFrame = toDataFrame({
      fields: [
        { name: 'A', type: FieldType.number, values: [1, 2, 3] },
        { name: 'B', type: FieldType.number, values: [4, 5, 6] },
      ],
    });

    // The array the query runner owns, and the one the truncation would reach.
    const bValues = sourceFrame.fields[1].values;

    const source = new SceneDataNode({
      data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [sourceFrame] },
    });

    const transformer = new SceneDataTransformer({ $data: source, transformations: [] });

    const panel = new VizPanel({
      pluginId: 'test-panel',
      $data: transformer,
      applyPluginTransformations: true,
      _UNSAFE_clearPreviousFieldValues: true,
      $timeRange: new SceneTimeRange({}),
    });

    return { panel, transformer, bValues };
  }

  const renderedFieldNames = () => renderedSeries.at(-1)?.[0].fields.map((f) => f.name);

  it('keeps B usable when a system transformation tier hides and shows it', async () => {
    const { panel, transformer, bValues } = setup();

    // How ad-hoc reaches the pipeline: a provider registered on the panel, contributing a tier that
    // is never part of `transformer.state.transformations`.
    let contributed: ContributedTransformation[] = [];

    panel.addSystemTransformationsProvider({
      origin: 'adhoc',
      getSystemTransformations: () => ({ append: contributed }),
    });

    render(<panel.Component model={panel} />);

    await act(async () => {
      panel.activate();
      transformer.activate();
    });

    expect(renderedFieldNames()).toEqual(['A', 'B']);

    contributed = [HIDE_B];
    await act(async () => {
      panel.notifySystemTransformationsChanged();
    });

    // The panel must actually have re-rendered without B, or the clearing never ran on it.
    expect(renderedFieldNames()).toEqual(['A']);
    expect(transformer.state.transformations).toEqual([]);

    contributed = [];
    await act(async () => {
      panel.notifySystemTransformationsChanged();
    });

    expect(renderedFieldNames()).toEqual(['A', 'B']);
    expect(bValues).toEqual([4, 5, 6]);
    expect(renderedSeries.at(-1)?.[0].fields.find((f) => f.name === 'B')?.values).toEqual([4, 5, 6]);
  });

  // The user-transformation path is deliberately not exempted: nothing in the product removes a
  // transformation without also refetching (PanelDataPaneNext calls runQueries after every edit), so
  // the optimization is kept. This records that, and will fail if that ever changes.
  it('still loses B when a user transformation hides and shows it with no refetch', async () => {
    const { panel, transformer, bValues } = setup();

    render(<panel.Component model={panel} />);

    await act(async () => {
      panel.activate();
      transformer.activate();
    });

    expect(renderedFieldNames()).toEqual(['A', 'B']);

    await act(async () => {
      transformer.setState({ transformations: [HIDE_B] });
      transformer.reprocessTransformations();
    });

    expect(renderedFieldNames()).toEqual(['A']);

    await act(async () => {
      transformer.setState({ transformations: [] });
      transformer.reprocessTransformations();
    });

    expect(renderedFieldNames()).toEqual(['A', 'B']);
    expect(bValues).toEqual([]);
  });
});
