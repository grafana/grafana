import { toDataFrame } from '@grafana/data';

import { getResourceDimension } from './resource';
import { ResourceDimensionMode } from './types';

describe('getResourceDimension', () => {
  it('fixed', () => {
    const frame = toDataFrame({
      fixed: 'fixed',
    });
    const config = { mode: ResourceDimensionMode.Fixed, fixed: 'fixed' };

    expect(getResourceDimension(undefined, config)).toEqual('fixed');
  });
});
