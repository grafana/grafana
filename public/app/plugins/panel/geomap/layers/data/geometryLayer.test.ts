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

import { type GeometryLayerConfig, geometryLayer } from './geometryLayer';

jest.mock('app/features/geo/gazetteer/gazetteer', () => ({
  ...jest.requireActual('app/features/geo/gazetteer/gazetteer'),
  getGazetteer: jest.fn().mockResolvedValue(undefined),
}));

// Real hex-EWKB values generated from PostGIS (SRID 4326), matching what a raw
// geography/geometry column, or encode(ST_AsBinary(col), 'hex'), returns.
const WKB_POINT_0_0 = '0101000020E610000000000000000000000000000000000000';
const WKB_LINESTRING_0_0_1_1 =
  '0102000020E61000000200000000000000000000000000000000000000000000000000F03F000000000000F03F';
const WKB_POLYGON_UNIT_SQUARE =
  '0103000020E61000000100000005000000000000000000000000000000000000000000000000000000000000000000F03F000000000000F03F000000000000F03F000000000000F03F000000000000000000000000000000000000000000000000';

const GEOJSON_POINT_0_0 = '{"type":"Point","coordinates":[0,0]}';
const GEOJSON_LINESTRING_0_0_1_1 = '{"type":"LineString","coordinates":[[0,0],[1,1]]}';
const GEOJSON_POLYGON_UNIT_SQUARE = '{"type":"Polygon","coordinates":[[[0,0],[0,1],[1,1],[1,0],[0,0]]]}';

const geometryData = (values: string[]): PanelData => ({
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [
    toDataFrame({
      fields: [{ name: 'geometry', type: FieldType.string, values }],
    }),
  ],
});

async function setup(mode: FrameGeometrySourceMode, config: Partial<GeometryLayerConfig> = {}) {
  const options: MapLayerOptions<GeometryLayerConfig> = {
    type: 'geometry',
    name: 'Geometry',
    location: { mode, geometry: 'geometry' },
    config: { style: defaultStyleConfig, ...config },
  };
  const handler = await geometryLayer.create({} as OpenLayersMap, options, new EventBusSrv(), createTheme());
  return { handler, layer: ensureInstanceOf(handler.init(), VectorImage) };
}

describe('geometryLayer WKT mode', () => {
  it('update() adds one feature per row parsed from the WKT field', async () => {
    const { handler, layer } = await setup(FrameGeometrySourceMode.Wkt);
    handler.update!(geometryData(['POINT(0 0)', 'LINESTRING(0 0, 1 1)', 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))']));

    const source = ensureInstanceOf(layer.getSource(), VectorSource);
    const features = source.getFeatures();
    expect(features).toHaveLength(3);
    expect(features.map((f) => f.getGeometry()?.getType())).toEqual(['Point', 'LineString', 'Polygon']);
  });

  it('update() clears features when there is no data', async () => {
    const { handler, layer } = await setup(FrameGeometrySourceMode.Wkt);
    handler.update!(geometryData(['POINT(0 0)']));
    handler.update!({ state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] });

    const source = ensureInstanceOf(layer.getSource(), VectorSource);
    expect(source.getFeatures()).toHaveLength(0);
  });

  it('the style function returns a distinct style per geometry type', async () => {
    const { handler, layer } = await setup(FrameGeometrySourceMode.Wkt);
    handler.update!(geometryData(['POINT(0 0)', 'LINESTRING(0 0, 1 1)', 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))']));

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
    const { handler, layer } = await setup(FrameGeometrySourceMode.Wkt, {
      style: { ...defaultStyleConfig, size: { ...defaultStyleConfig.size, fixed: 12 } },
    });
    handler.update!(geometryData(['LINESTRING(0 0, 1 1)', 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))']));

    const styleFn = layer.getStyleFunction();
    const source = ensureInstanceOf(layer.getSource(), VectorSource);
    const [lineFeature, polyFeature] = source.getFeatures();

    const lineStyle = ensureInstanceOf(styleFn!(lineFeature, 1), Style);
    const polyStyle = ensureInstanceOf(styleFn!(polyFeature, 1), Style);

    expect(lineStyle.getStroke()!.getWidth()).toBe(12);
    expect(polyStyle.getStroke()!.getWidth()).toBe(12);
  });

  it('renders a per-row field-driven text label for LineString and Polygon rows', async () => {
    const { handler, layer } = await setup(FrameGeometrySourceMode.Wkt, {
      style: { ...defaultStyleConfig, text: { mode: TextDimensionMode.Field, field: 'label', fixed: '' } },
    });
    const frame = toDataFrame({
      fields: [
        {
          name: 'geometry',
          type: FieldType.string,
          values: ['LINESTRING(0 0, 1 1)', 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))'],
        },
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

describe('geometryLayer WKB mode', () => {
  it('parses real hex-EWKB rows (as returned by a raw PostGIS geography column)', async () => {
    const { handler, layer } = await setup(FrameGeometrySourceMode.Wkb);
    handler.update!(geometryData([WKB_POINT_0_0, WKB_LINESTRING_0_0_1_1, WKB_POLYGON_UNIT_SQUARE]));

    const source = ensureInstanceOf(layer.getSource(), VectorSource);
    const features = source.getFeatures();
    expect(features).toHaveLength(3);
    expect(features.map((f) => f.getGeometry()?.getType())).toEqual(['Point', 'LineString', 'Polygon']);
  });

  it('leaves a truncated/malformed row undefined without throwing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { handler, layer } = await setup(FrameGeometrySourceMode.Wkb);
    // ol/format/WKB is lenient about non-hex characters and short-but-plausible payloads (it
    // doesn't validate before decoding), but a byte order marker alone (1 byte, no type/coords)
    // reliably throws (RangeError: offset outside the DataView bounds).
    handler.update!(geometryData(['01', WKB_POINT_0_0]));

    const source = ensureInstanceOf(layer.getSource(), VectorSource);
    const features = source.getFeatures();
    // A feature with no geometry has no extent, so the source's internal index doesn't
    // guarantee getFeatures() preserves insertion order -- look features up by rowIndex instead.
    const byRow = new Map(features.map((f) => [f.get('rowIndex'), f]));
    expect(byRow.get(0)?.getGeometry()).toBeUndefined();
    expect(byRow.get(1)?.getGeometry()?.getType()).toBe('Point');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('geometryLayer GeoJSON mode', () => {
  it('parses GeoJSON geometry rows', async () => {
    const { handler, layer } = await setup(FrameGeometrySourceMode.GeoJson);
    handler.update!(geometryData([GEOJSON_POINT_0_0, GEOJSON_LINESTRING_0_0_1_1, GEOJSON_POLYGON_UNIT_SQUARE]));

    const source = ensureInstanceOf(layer.getSource(), VectorSource);
    const features = source.getFeatures();
    expect(features).toHaveLength(3);
    expect(features.map((f) => f.getGeometry()?.getType())).toEqual(['Point', 'LineString', 'Polygon']);
  });
});
