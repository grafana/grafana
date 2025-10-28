import { createDataFrame } from '@grafana/data';
import { ResourceDimensionMode } from '@grafana/schema';

import { getResourceDimension } from './resource';

describe('getResourceDimension', () => {
  const publicPath = 'https://grafana.fake/public/';
  beforeAll(() => {
    window.__grafana_public_path__ = publicPath;
  });

  it('fixed relative path', () => {
    const frame = undefined;
    const fixedValue = 'img/icons/unicons/question-circle.svg';
    const config = { mode: ResourceDimensionMode.Fixed, fixed: fixedValue };

    expect(getResourceDimension(frame, config).value()).toEqual(`${publicPath}build/${fixedValue}`);
  });

  it('fixed full URL path', () => {
    const frame = undefined;
    const fixedUrlValue = 'https://3rdparty.fake/image.png';
    const config = { mode: ResourceDimensionMode.Fixed, fixed: fixedUrlValue };

    expect(getResourceDimension(frame, config).value()).toEqual(fixedUrlValue);
  });

  it('field URL path', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'image_field',
          values: ['https://3rdparty.fake/icon.png'],
          display: (v) => ({
            text: String(v),
            numeric: NaN,
            icon: undefined,
          }),
        },
      ],
    });
    const config = { mode: ResourceDimensionMode.Field, field: 'image_field', fixed: '' };

    expect(getResourceDimension(frame, config).value()).toEqual('https://3rdparty.fake/icon.png');
  });

  it('icon url', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'image_field',
          values: ['img1'],
          display: (v) => ({
            text: String(v),
            numeric: NaN,
            icon: v === 'img1' ? 'https://3rdparty.fake/field.png' : undefined,
          }),
        },
      ],
    });
    const config = { mode: ResourceDimensionMode.Field, field: 'image_field', fixed: '' };

    expect(getResourceDimension(frame, config).value()).toEqual('https://3rdparty.fake/field.png');
  });

  // TODO: write tests for mapping modes
});
