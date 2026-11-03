import type Feature from 'ol/Feature';
import type OpenLayersMap from 'ol/Map';
import VectorImage from 'ol/layer/VectorImage';
import Photo from 'ol-ext/style/Photo';

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

import { type PhotoConfig, photosLayer } from './photosLayer';

jest.mock('app/features/geo/gazetteer/gazetteer', () => ({
  ...jest.requireActual('app/features/geo/gazetteer/gazetteer'),
  getGazetteer: jest.fn().mockResolvedValue(undefined),
}));

const defaultConfig: PhotoConfig = {
  kind: 'square',
  border: 2,
  shadow: true,
  crop: true,
  radius: 20,
  color: 'rgb(200, 200, 200)',
};

const photoData = (urls: string[], fieldName = 'photo'): PanelData => ({
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: urls.map((_, i) => i) },
        { name: 'lat', type: FieldType.number, values: urls.map((_, i) => 46 + i) },
        { name: 'lon', type: FieldType.number, values: urls.map((_, i) => 6 + i) },
        { name: fieldName, type: FieldType.string, values: urls },
      ],
    }),
  ],
});

async function setup(config: Partial<PhotoConfig> = {}) {
  const options: MapLayerOptions<PhotoConfig> = {
    type: 'photos',
    name: 'Photos',
    location: { mode: FrameGeometrySourceMode.Coords, latitude: 'lat', longitude: 'lon' },
    config: { ...defaultConfig, ...config },
  };
  const handler = await photosLayer.create({} as OpenLayersMap, options, new EventBusSrv(), createTheme());
  return { handler, layer: ensureInstanceOf<VectorImage>(handler.init(), VectorImage) };
}

/** The layer renders a stack of styles per feature; the photo itself is always the last one */
function photoSrc(layer: VectorImage, feature: Feature): string {
  const styles = layer.getStyleFunction()!(feature, 1);
  if (!Array.isArray(styles)) {
    throw new Error('expected a stack of styles');
  }
  return ensureInstanceOf(styles[styles.length - 1].getImage(), Photo).getPhoto().src;
}

describe('photosLayer', () => {
  it('update() adds one feature per row', async () => {
    const { handler, layer } = await setup();
    handler.update!(photoData(['a.png', 'b.png', 'c.png']));
    expect(layer.getSource()!.getFeatures()).toHaveLength(3);
  });

  it('update() clears the features when there is no data', async () => {
    const { handler, layer } = await setup();
    handler.update!(photoData(['a.png']));
    handler.update!({ state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] });
    expect(layer.getSource()!.getFeatures()).toHaveLength(0);
  });

  it('renders each feature with the image from the configured source field', async () => {
    const { handler, layer } = await setup({ src: 'photo' });
    handler.update!(photoData(['https://example.com/a.png', 'https://example.com/b.png']));

    const [first, second] = layer.getSource()!.getFeatures();
    expect(photoSrc(layer, first)).toBe('https://example.com/a.png');
    expect(photoSrc(layer, second)).toBe('https://example.com/b.png');
  });

  it('falls back to the first string field when no source field is configured', async () => {
    const { handler, layer } = await setup();
    handler.update!(photoData(['https://example.com/a.png'], 'someOtherName'));

    const [first] = layer.getSource()!.getFeatures();
    expect(photoSrc(layer, first)).toBe('https://example.com/a.png');
  });
});
