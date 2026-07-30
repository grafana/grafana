import type OpenLayersMap from 'ol/Map';
import { Group as LayerGroup } from 'ol/layer';
import VectorImage from 'ol/layer/VectorImage';

import {
  createTheme,
  dateTime,
  EventBusSrv,
  getDefaultTimeRange,
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
    expect(group.getLayers().getLength()).toBe(2);
  });

  it('adds the sun layers when the sun is enabled', async () => {
    const { group } = await setup({ sun: true });
    expect(group.getLayers().getLength()).toBe(4);
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

  it('update() moves the sun to the position for the selected time', async () => {
    const { handler, group } = await setup({ sun: true });
    const sunFeature = ensureInstanceOf<VectorImage>(group.getLayers().item(1), VectorImage).getSource()!.getFeatures()[0];
    expect(sunFeature.getGeometry()!.getCoordinates()).toEqual([]);

    handler.update!(dataFor(timeRange));

    expect(sunFeature.getGeometry()!.getCoordinates()).toHaveLength(2);
  });

  it('dispose() tears down the crosshair subscriptions', async () => {
    const { handler } = await setup();
    expect(() => handler.dispose!()).not.toThrow();
  });

  it('update() works with the default time range', async () => {
    const { handler, nightSource } = await setup();
    handler.update!(dataFor(getDefaultTimeRange()));
    expect(nightSource.get('time')).toBeInstanceOf(Date);
  });
});
