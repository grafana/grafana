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

    expect(getResourceDimension(frame, config).fixed).toEqual(`${publicPath}build/${fixedValue}`);
  });

  it('fixed full URL path', () => {
    const frame = undefined;
    const fixedUrlValue = 'https://3rdparty.fake/image.png';
    const config = { mode: ResourceDimensionMode.Fixed, fixed: fixedUrlValue };

    expect(getResourceDimension(frame, config).fixed).toEqual(fixedUrlValue);
  });

  // TODO: write tests for field and mapping modes
});
