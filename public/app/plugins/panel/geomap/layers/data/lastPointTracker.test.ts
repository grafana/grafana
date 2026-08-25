import type OpenLayersMap from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';

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
import { getCenterPointWGS84 } from 'app/features/transformers/spatial/utils';

import { ensureInstanceOf } from '../test-utils';

import { type LastPointConfig, lastPointTracker } from './lastPointTracker';

// lastPointTracker imports the whole `ol/source` barrel, which pulls in ol/source/GeoTIFF ->
// geotiff -> quick-lru (untransformed ESM under jest). Only Vector is used, so stub the barrel.
jest.mock('ol/source', () => ({
  Vector: jest.requireActual('ol/source/Vector').default,
}));

jest.mock('app/features/geo/gazetteer/gazetteer', () => ({
  ...jest.requireActual('app/features/geo/gazetteer/gazetteer'),
  getGazetteer: jest.fn().mockResolvedValue(undefined),
}));

const coordsData = (lats: number[], lons: number[]): PanelData => ({
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

async function setup() {
  const options: MapLayerOptions<LastPointConfig> = {
    type: 'last-point-tracker',
    name: 'Last point',
    location: { mode: FrameGeometrySourceMode.Coords, latitude: 'lat', longitude: 'lon' },
    config: {},
  };
  return lastPointTracker.create({} as OpenLayersMap, options, new EventBusSrv(), createTheme());
}

describe('lastPointTracker', () => {
  it('init() returns a vector layer holding a single feature', async () => {
    const handler = await setup();
    const layer = handler.init();
    expect(layer).toBeInstanceOf(VectorLayer);
    expect(ensureInstanceOf<VectorLayer>(layer, VectorLayer).getSource()!.getFeatures()).toHaveLength(1);
  });

  it('update() moves the point to the last row coordinate', async () => {
    const handler = await setup();
    const layer = ensureInstanceOf<VectorLayer>(handler.init(), VectorLayer);

    handler.update!(coordsData([0, 10, 20], [0, 30, 60]));

    const point = layer.getSource()!.getFeatures()[0].getGeometry()!;
    const [lon, lat] = getCenterPointWGS84(point)!;
    expect(lon).toBeCloseTo(60);
    expect(lat).toBeCloseTo(20);
  });

  it('update() leaves the point untouched for an empty frame', async () => {
    const handler = await setup();
    const layer = ensureInstanceOf<VectorLayer>(handler.init(), VectorLayer);
    const point = layer.getSource()!.getFeatures()[0];

    handler.update!({ state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] });

    expect(point.getGeometry()).toBeUndefined();
  });
});
