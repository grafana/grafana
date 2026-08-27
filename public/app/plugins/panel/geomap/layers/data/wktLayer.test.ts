import type OpenLayersMap from 'ol/Map';
import VectorImage from 'ol/layer/VectorImage';
import VectorSource from 'ol/source/Vector';
import { Style } from 'ol/style';

import {
  createTheme,
  EventBusSrv,
  FieldType,
  FrameGeometrySourceMode,
  getDefaultTimeRange,
  getDisplayProcessor,
  LoadingState,
  type MapLayerOptions,
  type PanelData,
  toDataFrame,
} from '@grafana/data';
import { TextDimensionMode } from '@grafana/schema';

import { defaultStyleConfig } from '../../style/types';
import { ensureInstanceOf } from '../test-utils';

import { type WktLayerConfig, wktLayer } from './wktLayer';

jest.mock('app/features/geo/gazetteer/gazetteer', () => ({
  ...jest.requireActual('app/features/geo/gazetteer/gazetteer'),
  getGazetteer: jest.fn().mockResolvedValue(undefined),
}));

const wktData = (values: string[]): PanelData => ({
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [
    toDataFrame({
      fields: [{ name: 'wkt', type: FieldType.string, values }],
    }),
  ],
});

async function setup(config: Partial<WktLayerConfig> = {}) {
  const options: MapLayerOptions<WktLayerConfig> = {
    type: 'wkt',
    name: 'WKT',
    location: { mode: FrameGeometrySourceMode.Wkt, wkt: 'wkt' },
    config: { style: defaultStyleConfig, ...config },
  };
  const handler = await wktLayer.create({} as OpenLayersMap, options, new EventBusSrv(), createTheme());
  return { handler, layer: ensureInstanceOf(handler.init(), VectorImage) };
}

describe('wktLayer', () => {
  it('update() adds one feature per row parsed from the WKT field', async () => {
    const { handler, layer } = await setup();
    handler.update!(wktData(['POINT(0 0)', 'LINESTRING(0 0, 1 1)', 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))']));

    const source = ensureInstanceOf(layer.getSource(), VectorSource);
    const features = source.getFeatures();
    expect(features).toHaveLength(3);
    expect(features.map((f) => f.getGeometry()?.getType())).toEqual(['Point', 'LineString', 'Polygon']);
  });

  it('update() clears features when there is no data', async () => {
    const { handler, layer } = await setup();
    handler.update!(wktData(['POINT(0 0)']));
    handler.update!({ state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] });

    const source = ensureInstanceOf(layer.getSource(), VectorSource);
    expect(source.getFeatures()).toHaveLength(0);
  });

  it('the style function returns a distinct style per geometry type', async () => {
    const { handler, layer } = await setup();
    handler.update!(wktData(['POINT(0 0)', 'LINESTRING(0 0, 1 1)', 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))']));

    const styleFn = layer.getStyleFunction();
    expect(styleFn).toBeDefined();

    const source = ensureInstanceOf(layer.getSource(), VectorSource);
    const [pointFeature, lineFeature, polyFeature] = source.getFeatures();

    const pointStyle = ensureInstanceOf(styleFn!(pointFeature, 1), Style);
    const lineStyle = ensureInstanceOf(styleFn!(lineFeature, 1), Style);
    const polyStyle = ensureInstanceOf(styleFn!(polyFeature, 1), Style);

    // Point rows fall back to the marker maker, which draws an image (no stroke-only marker).
    expect(pointStyle.getImage()).toBeTruthy();
    // Line/Polygon rows are drawn via stroke/fill, with no point image.
    expect(lineStyle.getImage()).toBeFalsy();
    expect(lineStyle.getStroke()).toBeTruthy();
    expect(polyStyle.getImage()).toBeFalsy();
    expect(polyStyle.getStroke()).toBeTruthy();
    expect(polyStyle.getFill()).toBeTruthy();
  });

  it('the Size style value doubles as stroke width for LineString and Polygon rows', async () => {
    const { handler, layer } = await setup({
      style: { ...defaultStyleConfig, size: { ...defaultStyleConfig.size, fixed: 12 } },
    });
    handler.update!(wktData(['LINESTRING(0 0, 1 1)', 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))']));

    const styleFn = layer.getStyleFunction();
    const source = ensureInstanceOf(layer.getSource(), VectorSource);
    const [lineFeature, polyFeature] = source.getFeatures();

    const lineStyle = ensureInstanceOf(styleFn!(lineFeature, 1), Style);
    const polyStyle = ensureInstanceOf(styleFn!(polyFeature, 1), Style);

    expect(lineStyle.getStroke()!.getWidth()).toBe(12);
    expect(polyStyle.getStroke()!.getWidth()).toBe(12);
  });

  it('renders a per-row field-driven text label for LineString and Polygon rows', async () => {
    const { handler, layer } = await setup({
      style: { ...defaultStyleConfig, text: { mode: TextDimensionMode.Field, field: 'label' } },
    });
    const frame = toDataFrame({
      fields: [
        { name: 'wkt', type: FieldType.string, values: ['LINESTRING(0 0, 1 1)', 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))'] },
        { name: 'label', type: FieldType.string, values: ['segment-a', 'segment-b'] },
      ],
    });
    // The real panel pipeline (applyFieldOverrides) attaches this; toDataFrame alone doesn't,
    // and getTextDimension relies on it to read a field's per-row value as text.
    const theme = createTheme();
    frame.fields[1].display = getDisplayProcessor({ field: frame.fields[1], theme });
    handler.update!({ state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [frame] });

    const styleFn = layer.getStyleFunction();
    const source = ensureInstanceOf(layer.getSource(), VectorSource);
    const [lineFeature, polyFeature] = source.getFeatures();

    const lineStyle = ensureInstanceOf(styleFn!(lineFeature, 1), Style);
    const polyStyle = ensureInstanceOf(styleFn!(polyFeature, 1), Style);

    expect(lineStyle.getText()?.getText()).toBe('segment-a');
    expect(polyStyle.getText()?.getText()).toBe('segment-b');
  });
});
