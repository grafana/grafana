import type OpenLayersMap from 'ol/Map';
import { Group as LayerGroup } from 'ol/layer';
import VectorImage from 'ol/layer/VectorImage';
import { toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import DayNight from 'ol-ext/source/DayNight';
import { Subscription } from 'rxjs';

import {
  createTheme,
  dateTime,
  EventBusSrv,
  LoadingState,
  type MapLayerOptions,
  type PanelData,
  type TimeRange,
} from '@grafana/data';

import { ensureInstanceOf } from '../test-utils';

import { type DayNightConfig, dayNightLayer, ShowTime } from './dayNightLayer';

const defaultConfig: DayNightConfig = {
  show: ShowTime.To,
  sun: false,
  nightColor: '#a7a6ba4D',
};

const from = dateTime('2024-06-01T00:00:00Z');
const to = dateTime('2024-06-01T12:00:00Z');
const timeRange: TimeRange = { from, to, raw: { from, to } };

const dataFor = (range: TimeRange): PanelData => ({
  state: LoadingState.Done,
  timeRange: range,
  series: [],
});

async function setup(config: Partial<DayNightConfig> = {}) {
  const options: MapLayerOptions<DayNightConfig> = {
    type: 'dayNight',
    name: 'Night / Day',
    config: { ...defaultConfig, ...config },
  };
  const handler = await dayNightLayer.create({} as OpenLayersMap, options, new EventBusSrv(), createTheme());
  const group = ensureInstanceOf(handler.init(), LayerGroup);
  const [nightLayer] = group.getLayers().getArray();
  return { handler, group, nightSource: ensureInstanceOf<VectorImage>(nightLayer, VectorImage).getSource()! };
}

describe('dayNightLayer', () => {
  it('renders the night region and its crosshair line', async () => {
    const { group } = await setup();
    const layers = group.getLayers().getArray();
    expect(layers).toHaveLength(2);
    // the night region draws from the DayNight source; the crosshair line from a plain vector source
    expect(ensureInstanceOf<VectorImage>(layers[0], VectorImage).getSource()).toBeInstanceOf(DayNight);
    expect(ensureInstanceOf<VectorImage>(layers[1], VectorImage).getSource()).toBeInstanceOf(VectorSource);
  });

  it('adds the sun layers carrying the sun feature when the sun is enabled', async () => {
    const { group } = await setup({ sun: true });
    const layers = group.getLayers().getArray();
    expect(layers).toHaveLength(4);
    // the extra layers carry the sun overlay: a single Point feature
    const sunSource = ensureInstanceOf<VectorImage>(layers[1], VectorImage).getSource()!;
    expect(sunSource.getFeatures()).toHaveLength(1);
  });

  it('update() shows the night region at the end of the time range', async () => {
    const { handler, nightSource } = await setup({ show: ShowTime.To });
    handler.update!(dataFor(timeRange));
    expect(nightSource.get('time')).toEqual(new Date(to.valueOf()));
  });

  it('update() shows the night region at the start of the time range', async () => {
    const { handler, nightSource } = await setup({ show: ShowTime.From });
    handler.update!(dataFor(timeRange));
    expect(nightSource.get('time')).toEqual(new Date(from.valueOf()));
  });

  it('update() moves the sun to the subsolar point for the selected time', async () => {
    const { handler, group } = await setup({ sun: true });
    const sunFeature = ensureInstanceOf<VectorImage>(group.getLayers().item(1), VectorImage)
      .getSource()!
      .getFeatures()[0];
    expect(sunFeature.getGeometry()!.getCoordinates()).toEqual([]);

    handler.update!(dataFor(timeRange));

    // deterministic for the fixed `to` time (2024-06-01T12:00:00Z): read back to lon/lat and freeze
    // the subsolar point (~noon at Greenwich, June declination ~+22°) so a change in the math fails here
    const [lon, lat] = toLonLat(sunFeature.getGeometry()!.getCoordinates());
    expect(lon).toBeCloseTo(-0.5156, 3);
    expect(lat).toBeCloseTo(22.1567, 3);
  });

  it('dispose() unsubscribes its crosshair subscriptions', async () => {
    const { handler } = await setup();
    const unsubscribe = jest.spyOn(Subscription.prototype, 'unsubscribe');
    handler.dispose!();
    expect(unsubscribe).toHaveBeenCalled();
    unsubscribe.mockRestore();
  });
});
