import type Feature from 'ol/Feature';
import type OpenLayersMap from 'ol/Map';
import { LineString } from 'ol/geom';
import { Group as LayerGroup } from 'ol/layer';
import VectorImage from 'ol/layer/VectorImage';

import {
  createTheme,
  DataHoverClearEvent,
  DataHoverEvent,
  EventBusSrv,
  FieldType,
  FrameGeometrySourceMode,
  getDefaultTimeRange,
  LoadingState,
  toDataFrame,
  type PanelData,
} from '@grafana/data';

import { defaultStyleConfig } from '../../style/types';

import { routeLayer } from './routeLayer';

jest.mock('app/features/geo/gazetteer/gazetteer', () => ({
  ...jest.requireActual('app/features/geo/gazetteer/gazetteer'),
  getGazetteer: jest.fn().mockResolvedValue(undefined),
}));

const t0 = 1700000000000;

const trackData = (lats: number[], lons: number[]): PanelData => ({
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: lats.map((_, i) => t0 + i * 1000) },
        { name: 'lat', type: FieldType.number, values: lats },
        { name: 'lon', type: FieldType.number, values: lons },
      ],
    }),
  ],
});

describe('routeLayer', () => {
  async function setup() {
    const eventBus = new EventBusSrv();
    // The map is only used to size the crosshair lines to the visible extent.
    const map = {
      getView: () => ({ calculateExtent: () => [0, 0, 100, 100] }),
      getSize: () => [100, 100],
    } as unknown as OpenLayersMap;
    const handler = await routeLayer.create(
      map,
      {
        type: 'route',
        name: 'Route',
        location: { mode: FrameGeometrySourceMode.Coords, latitude: 'lat', longitude: 'lon' },
        config: { style: defaultStyleConfig },
      },
      eventBus,
      createTheme()
    );
    const group = handler.init();
    if (!(group instanceof LayerGroup)) {
      throw new Error('expected route layer to be a layer group');
    }
    const [route, crosshair, lines] = group.getLayers().getArray();
    if (!(route instanceof VectorImage) || !(crosshair instanceof VectorImage) || !(lines instanceof VectorImage)) {
      throw new Error('expected vector image sublayers');
    }
    return {
      eventBus,
      handler,
      routeSource: route.getSource()!,
      crosshairFeature: crosshair.getSource()!.getFeatures()[0],
      lineFeatures: lines.getSource()!.getFeatures(),
    };
  }

  it('renders the track as a single line feature', async () => {
    const { handler, routeSource } = await setup();
    handler.update!(trackData([46.0, 46.1, 46.2], [6.0, 6.1, 6.2]));
    expect(routeSource.getFeatures()).toHaveLength(1);
    expect(routeSource.getFeatures()[0].getGeometry()).toBeInstanceOf(LineString);
  });

  it('clears the crosshair geometry on DataHoverClearEvent', async () => {
    const { eventBus, handler, crosshairFeature, lineFeatures } = await setup();
    handler.update!(trackData([46.0, 46.1, 46.2], [6.0, 6.1, 6.2]));

    eventBus.publish(new DataHoverEvent({ point: { time: t0 } }));
    expect(crosshairFeature.getGeometry()).toBeDefined();
    lineFeatures.forEach((f: Feature) => expect(f.getGeometry()).toBeDefined());

    eventBus.publish(new DataHoverClearEvent());

    // Stale geometry would pollute the "fit to data" extent (getLayersExtent).
    expect(crosshairFeature.getGeometry()).toBeUndefined();
    lineFeatures.forEach((f: Feature) => expect(f.getGeometry()).toBeUndefined());
  });

  it('clears the crosshair geometry on a subsequent update', async () => {
    const { eventBus, handler, crosshairFeature, lineFeatures } = await setup();
    handler.update!(trackData([46.0, 46.1, 46.2], [6.0, 6.1, 6.2]));

    eventBus.publish(new DataHoverEvent({ point: { time: t0 } }));
    expect(crosshairFeature.getGeometry()).toBeDefined();

    handler.update!(trackData([47.0, 47.1], [7.0, 7.1]));

    expect(crosshairFeature.getGeometry()).toBeUndefined();
    lineFeatures.forEach((f: Feature) => expect(f.getGeometry()).toBeUndefined());
  });

  it('clears the crosshair geometry on an update with no series', async () => {
    const { eventBus, handler, crosshairFeature, lineFeatures } = await setup();
    handler.update!(trackData([46.0, 46.1, 46.2], [6.0, 6.1, 6.2]));

    eventBus.publish(new DataHoverEvent({ point: { time: t0 } }));
    expect(crosshairFeature.getGeometry()).toBeDefined();

    handler.update!({ state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] });

    expect(crosshairFeature.getGeometry()).toBeUndefined();
    lineFeatures.forEach((f: Feature) => expect(f.getGeometry()).toBeUndefined());
  });
});
