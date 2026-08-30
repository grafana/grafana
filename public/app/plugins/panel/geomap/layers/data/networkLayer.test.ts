import type OpenLayersMap from 'ol/Map';
import { LineString, Point } from 'ol/geom';
import VectorImage from 'ol/layer/VectorImage';
import { toLonLat } from 'ol/proj';

import {
  createTheme,
  type DataFrame,
  EventBusSrv,
  FieldType,
  FrameGeometrySourceMode,
  getDefaultTimeRange,
  LoadingState,
  type MapLayerOptions,
  type PanelData,
  toDataFrame,
} from '@grafana/data';

import { defaultStyleConfig } from '../../style/types';
import { ensureInstanceOf } from '../test-utils';

import { type NetworkConfig, networkLayer } from './networkLayer';

jest.mock('app/features/geo/gazetteer/gazetteer', () => ({
  ...jest.requireActual('app/features/geo/gazetteer/gazetteer'),
  getGazetteer: jest.fn().mockResolvedValue(undefined),
}));

const nodeFrame = toDataFrame({
  name: 'nodes',
  fields: [
    { name: 'id', type: FieldType.string, values: ['a', 'b', 'c'] },
    { name: 'lat', type: FieldType.number, values: [46, 47, 48] },
    { name: 'lon', type: FieldType.number, values: [6, 7, 8] },
  ],
});

const edgeFrame = toDataFrame({
  name: 'edges',
  fields: [
    { name: 'id', type: FieldType.string, values: ['e1', 'e2'] },
    { name: 'source', type: FieldType.string, values: ['a', 'b'] },
    { name: 'target', type: FieldType.string, values: ['b', 'c'] },
  ],
});

const graphData = (series: DataFrame[]): PanelData => ({
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series,
});

async function setup(config: Partial<NetworkConfig> = {}) {
  const options: MapLayerOptions<NetworkConfig> = {
    type: 'network',
    name: 'Network',
    location: { mode: FrameGeometrySourceMode.Coords, latitude: 'lat', longitude: 'lon' },
    config: { style: defaultStyleConfig, edgeStyle: defaultStyleConfig, arrow: 0, showLegend: false, ...config },
  };
  const handler = await networkLayer.create({} as OpenLayersMap, options, new EventBusSrv(), createTheme());
  const layer = ensureInstanceOf<VectorImage>(handler.init(), VectorImage);
  return { handler, source: layer.getSource()! };
}

describe('networkLayer', () => {
  it('update() renders a feature per node plus a line per edge', async () => {
    const { handler, source } = await setup();
    handler.update!(graphData([nodeFrame, edgeFrame]));

    const geometries = source.getFeatures().map((f) => f.getGeometry());
    expect(geometries.filter((g) => g instanceof LineString)).toHaveLength(2);
    expect(geometries.filter((g) => g instanceof Point)).toHaveLength(3);
  });

  it('update() connects each edge to the coordinates of its source and target nodes', async () => {
    const { handler, source } = await setup();
    handler.update!(graphData([nodeFrame, edgeFrame]));

    const [firstEdge] = source.getFeatures().filter((f) => f.getGeometry() instanceof LineString);
    const line = ensureInstanceOf(firstEdge.getGeometry(), LineString);
    const [start, end] = line.getCoordinates();
    // coords are web-mercator projected; read them back to lon/lat and compare to the a->b node inputs
    const [startLon, startLat] = toLonLat(start);
    const [endLon, endLat] = toLonLat(end);
    expect([startLon, startLat]).toEqual([expect.closeTo(6), expect.closeTo(46)]);
    expect([endLon, endLat]).toEqual([expect.closeTo(7), expect.closeTo(47)]);
  });

  it('update() renders nothing when the edges frame is missing', async () => {
    const { handler, source } = await setup();
    handler.update!(graphData([nodeFrame]));
    expect(source.getFeatures()).toHaveLength(0);
  });

  it('update() clears the features when there is no data', async () => {
    const { handler, source } = await setup();
    handler.update!(graphData([nodeFrame, edgeFrame]));
    handler.update!(graphData([]));
    expect(source.getFeatures()).toHaveLength(0);
  });

  it('only builds a legend when one is configured', async () => {
    const { handler: withLegend } = await setup({ showLegend: true });
    const { handler: without } = await setup({ showLegend: false });
    expect(withLegend.legend).not.toBeNull();
    expect(without.legend).toBeNull();
  });
});
