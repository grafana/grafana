import { ResourceDimensionMode } from '@grafana/schema';

import { getResourceDimension } from './resource';

describe('getResourceDimension', () => {
  const publicPath = '/public/';
  beforeAll(() => {
    window.__grafana_public_path__ = publicPath;
  });

  it('fixed mode', () => {
    const frame = undefined;
    const fixedValue = 'img/icons/unicons/question-circle.svg';
    const config = { mode: ResourceDimensionMode.Fixed, fixed: fixedValue };

    expect(getResourceDimension(frame, config).fixed).toEqual(publicPath + fixedValue);
  });

  // TODO: write tests for field and mapping modes
});
