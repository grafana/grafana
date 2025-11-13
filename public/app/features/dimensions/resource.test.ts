import { createDataFrame } from '@grafana/data';
import { ResourceDimensionMode } from '@grafana/schema';

import { getPublicOrAbsoluteUrl, getResourceDimension } from './resource';

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

  it('should return empty string for boolean field values', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'image_field',
          values: [true],
          display: (v) => ({
            text: String(v),
            numeric: NaN,
            icon: undefined,
          }),
        },
      ],
    });
    const config = { mode: ResourceDimensionMode.Field, field: 'image_field', fixed: '' };

    expect(getResourceDimension(frame, config).get(0)).toEqual('');
    expect(getResourceDimension(frame, config).value()).toEqual('');
  });

  it('should return empty string for numeric field values', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'image_field',
          values: [123],
          display: (v) => ({
            text: String(v),
            numeric: Number(v),
            icon: undefined,
          }),
        },
      ],
    });
    const config = { mode: ResourceDimensionMode.Field, field: 'image_field', fixed: '' };

    expect(getResourceDimension(frame, config).get(0)).toEqual('');
    expect(getResourceDimension(frame, config).value()).toEqual('');
  });

  // TODO: write tests for mapping modes
});

describe('getPublicOrAbsoluteUrl', () => {
  const publicPath = 'https://grafana.fake/public/';
  beforeAll(() => {
    window.__grafana_public_path__ = publicPath;
  });

  it('should handle string paths correctly', () => {
    expect(getPublicOrAbsoluteUrl('icon.png')).toEqual(`${publicPath}build/icon.png`);
    expect(getPublicOrAbsoluteUrl('https://example.com/icon.png')).toEqual('https://example.com/icon.png');
  });

  it('should return empty string for non-string values', () => {
    expect(getPublicOrAbsoluteUrl(true)).toEqual('');
    expect(getPublicOrAbsoluteUrl(123)).toEqual('');
    expect(getPublicOrAbsoluteUrl(null)).toEqual('');
    expect(getPublicOrAbsoluteUrl(undefined)).toEqual('');
    expect(getPublicOrAbsoluteUrl({ path: 'icon.png' })).toEqual('');
    expect(getPublicOrAbsoluteUrl(['icon.png'])).toEqual('');
  });
});
