import type OpenLayersMap from 'ol/Map';
import { Heatmap } from 'ol/layer';

import {
  createTheme,
  EventBusSrv,
  FieldType,
  FrameGeometrySourceMode,
  getDefaultTimeRange,
  LoadingState,
  type MapLayerOptions,
  type PanelData,
  toDataFrame,
} from '@grafana/data';

import { ensureInstanceOf } from '../test-utils';

import { type HeatmapConfig, heatmapLayer } from './heatMap';

jest.mock('app/features/geo/gazetteer/gazetteer', () => ({
  ...jest.requireActual('app/features/geo/gazetteer/gazetteer'),
  getGazetteer: jest.fn().mockResolvedValue(undefined),
}));

const defaultConfig: HeatmapConfig = {
  weight: { fixed: 1, min: 0, max: 1 },
  blur: 15,
  radius: 5,
};

const pointData = (values: number[], colorMode?: string): PanelData => ({
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: values.map((_, i) => i) },
        { name: 'lat', type: FieldType.number, values: values.map((_, i) => 46 + i) },
        { name: 'lon', type: FieldType.number, values: values.map((_, i) => 6 + i) },
        { name: 'value', type: FieldType.number, values, config: colorMode ? { color: { mode: colorMode } } : {} },
      ],
    }),
  ],
});

async function setup(config: Partial<HeatmapConfig> = {}) {
  const options: MapLayerOptions<HeatmapConfig> = {
    type: 'heatmap',
    name: 'Heatmap',
    location: { mode: FrameGeometrySourceMode.Coords, latitude: 'lat', longitude: 'lon' },
    config: { ...defaultConfig, ...config },
  };
  const handler = await heatmapLayer.create({} as OpenLayersMap, options, new EventBusSrv(), createTheme());
  return { handler, layer: ensureInstanceOf(handler.init(), Heatmap) };
}

describe('heatmapLayer', () => {
  it('applies the configured radius and blur to the layer', async () => {
    const { layer } = await setup({ radius: 12, blur: 30 });
    expect(layer.getRadius()).toBe(12);
    expect(layer.getBlur()).toBe(30);
  });

  it('update() adds one feature per row', async () => {
    const { handler, layer } = await setup();
    handler.update!(pointData([10, 20, 30]));
    expect(layer.getSource()!.getFeatures()).toHaveLength(3);
  });

  it('update() scales the weight of each feature from the configured field', async () => {
    const { handler, layer } = await setup({ weight: { field: 'value', fixed: 0, min: 0, max: 1 } });
    handler.update!(pointData([10, 20]));

    // the heatmap reads this property back through its weight callback
    const weights = layer
      .getSource()!
      .getFeatures()
      .map((f) => f.get('_weight'));
    expect(weights).toEqual([0, 1]);
  });

  it('update() keeps the default gradient for a field with no continuous color scheme', async () => {
    const { handler, layer } = await setup();
    const before = layer.getGradient();
    handler.update!(pointData([10, 20]));
    expect(layer.getGradient()).toEqual(before);
  });

  it('update() takes the gradient from the weight field continuous color scheme', async () => {
    const { handler, layer } = await setup({ weight: { field: 'value', fixed: 0, min: 0, max: 1 } });
    const before = layer.getGradient();
    handler.update!(pointData([10, 20], 'continuous-GrYlRd'));
    expect(layer.getGradient()).not.toEqual(before);
  });
});
