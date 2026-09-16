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
import { SceneDataNode, SceneDataTransformer, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { getAdHocTransformations } from './AdHocTransformations';

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

  it('retains field values removed by a system transformation', async () => {
    const { panel, transformer, bValues } = setup();

    const adHocTransformations = getAdHocTransformations(panel)!;

    render(<panel.Component model={panel} />);

    await act(async () => {
      panel.activate();
      transformer.activate();
    });

    expect(renderedFieldNames()).toEqual(['A', 'B']);

    await act(async () => {
      adHocTransformations.set([HIDE_B]);
    });

    expect(renderedFieldNames()).toEqual(['A']);
    expect(transformer.state.transformations).toEqual([]);

    await act(async () => {
      adHocTransformations.set([]);
    });

    expect(renderedFieldNames()).toEqual(['A', 'B']);
    expect(bValues).toEqual([4, 5, 6]);
    expect(renderedSeries.at(-1)?.[0].fields.find((f) => f.name === 'B')?.values).toEqual([4, 5, 6]);
  });

  it('clears field values removed by a saved transformation without a refetch', async () => {
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
