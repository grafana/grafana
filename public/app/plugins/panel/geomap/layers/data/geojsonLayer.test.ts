import type OpenLayersMap from 'ol/Map';
import VectorImage from 'ol/layer/VectorImage';

import { createTheme, EventBusSrv, type MapLayerOptions } from '@grafana/data';

import { defaultStyleConfig } from '../../style/types';
import { ensureInstanceOf } from '../test-utils';

import { type GeoJSONMapperConfig, geojsonLayer } from './geojsonLayer';

const replaceMock = jest.fn((text: string) => text);
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: replaceMock }),
}));

async function layerUrl(config: Partial<GeoJSONMapperConfig>) {
  const options: MapLayerOptions<GeoJSONMapperConfig> = {
    type: 'geojson',
    name: 'GeoJSON',
    config: { rules: [], style: defaultStyleConfig, ...config },
  };
  const handler = await geojsonLayer.create({} as OpenLayersMap, options, new EventBusSrv(), createTheme());
  return ensureInstanceOf<VectorImage>(handler.init(), VectorImage).getSource()!.getUrl();
}

describe('geojsonLayer', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    replaceMock.mockImplementation((text) => text);
    window.__grafana_public_path__ = 'http://localhost:3000/public/';
  });

  it('resolves a bundled map against the public path', async () => {
    expect(await layerUrl({ src: 'public/maps/countries.geojson' })).toBe(
      'http://localhost:3000/public/maps/countries.geojson'
    );
  });

  it('leaves an absolute url untouched', async () => {
    const src = 'https://example.com/borders.geojson';
    expect(await layerUrl({ src })).toBe(src);
  });

  it('interpolates dashboard variables in the url', async () => {
    replaceMock.mockImplementation((text) => text.replace('$region', 'emea'));
    expect(await layerUrl({ src: 'https://example.com/$region.geojson' })).toBe('https://example.com/emea.geojson');
    expect(replaceMock).toHaveBeenCalledWith('https://example.com/$region.geojson');
  });

  it('falls back to an empty src rather than interpolating undefined', async () => {
    await layerUrl({ src: undefined });
    expect(replaceMock).toHaveBeenCalledWith('');
  });
});
