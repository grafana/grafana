import type OpenLayersMap from 'ol/Map';
import { Group as LayerGroup } from 'ol/layer';
import VectorImage from 'ol/layer/VectorImage';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';

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
import { TextDimensionMode } from '@grafana/schema';

import { defaultStyleConfig } from '../../style/types';
import { ensureInstanceOf } from '../test-utils';

import { type MarkersConfig, markersLayer } from './markersLayer';

jest.mock('app/features/geo/gazetteer/gazetteer', () => ({
  ...jest.requireActual('app/features/geo/gazetteer/gazetteer'),
  getGazetteer: jest.fn().mockResolvedValue(undefined),
}));

const pointData = (lats: number[], lons: number[]): PanelData => ({
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: lats.map((_, i) => i) },
        { name: 'lat', type: FieldType.number, values: lats },
        { name: 'lon', type: FieldType.number, values: lons },
      ],
    }),
  ],
});

async function setup(config: Partial<MarkersConfig> = {}) {
  const options: MapLayerOptions<MarkersConfig> = {
    type: 'markers',
    name: 'Markers',
    location: { mode: FrameGeometrySourceMode.Coords, latitude: 'lat', longitude: 'lon' },
    config: { style: defaultStyleConfig, showLegend: false, ...config },
  };
  const handler = await markersLayer.create({} as OpenLayersMap, options, new EventBusSrv(), createTheme());
  return { handler, group: ensureInstanceOf(handler.init(), LayerGroup) };
}

const textStyle = {
  ...defaultStyleConfig,
  text: { mode: TextDimensionMode.Fixed, fixed: 'label' },
};

describe('markersLayer', () => {
  it('renders symbols through a single WebGL layer when the style has no text', async () => {
    const { group } = await setup();
    const layers = group.getLayers().getArray();
    expect(layers).toHaveLength(1);
    expect(layers[0]).toBeInstanceOf(WebGLPointsLayer);
  });

  it('adds a vector layer alongside the symbols when the style has text', async () => {
    const { group } = await setup({ style: textStyle });
    const layers = group.getLayers().getArray();
    expect(layers).toHaveLength(2);
    expect(layers[0]).toBeInstanceOf(WebGLPointsLayer);
    expect(layers[1]).toBeInstanceOf(VectorImage);
  });

  it('update() adds one feature per row and sets the WebGL style properties', async () => {
    const { handler, group } = await setup();
    handler.update!(pointData([46, 47], [6, 7]));

    const source = ensureInstanceOf(group.getLayers().item(0), WebGLPointsLayer).getSource()!;
    const features = source.getFeatures();
    expect(features).toHaveLength(2);
    // WebGLPointsLayer styles from feature properties rather than a style function
    expect(features[0].get('size')).toBe(defaultStyleConfig.size.fixed * 2);
    expect(features[0].get('opacity')).toBeCloseTo(defaultStyleConfig.opacity);
    expect(features[0].get('red')).toEqual(expect.any(Number));
  });

  it('update() skips markers that would render identically on top of each other', async () => {
    const { handler, group } = await setup();
    handler.update!(pointData([46, 46], [6, 6]));

    const source = ensureInstanceOf(group.getLayers().item(0), WebGLPointsLayer).getSource()!;
    const [first, duplicate] = source.getFeatures();
    expect(first.get('size')).toBeDefined();
    expect(duplicate.get('size')).toBeUndefined();
  });

  it('update() clears the features when there is no data', async () => {
    const { handler, group } = await setup();
    handler.update!(pointData([46], [6]));
    handler.update!({ state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] });

    const source = ensureInstanceOf(group.getLayers().item(0), WebGLPointsLayer).getSource()!;
    expect(source.getFeatures()).toHaveLength(0);
  });

  it('only builds a legend when one is configured', async () => {
    const { handler: withLegend } = await setup({ showLegend: true });
    const { handler: without } = await setup({ showLegend: false });
    expect(withLegend.legend).not.toBeNull();
    expect(without.legend).toBeNull();
  });
});
