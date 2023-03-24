import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import { DataLinkBuiltInVars } from '@grafana/data';
import { getTemplateSrv, setTemplateSrv } from '@grafana/runtime';

import { setTimeSrv } from '../dashboard/services/TimeSrv';
import { variableAdapters } from '../variables/adapters';
import { createQueryVariableAdapter } from '../variables/query/adapter';

describe('__all_variables', () => {
  beforeAll(() => {
    variableAdapters.register(createQueryVariableAdapter());

    setTemplateSrv(
      initTemplateSrv('hello', [
        {
          type: 'query',
          name: 'test',
          rootStateKey: 'hello',
          current: { value: ['val1', 'val2'] },
          getValueForUrl: function () {
            return this.current.value;
          },
        },
      ])
    );
  });

  it('should interpolate correctly', () => {
    const out = getTemplateSrv().replace(`/d/1?$${DataLinkBuiltInVars.includeVars}`);
    expect(out).toBe('/d/1?var-test=val1&var-test=val2');
  });

  it('should interpolate and take scopedVars into account', () => {
    const out = getTemplateSrv().replace(`/d/1?$${DataLinkBuiltInVars.includeVars}`, { test: { value: 'val3' } });
    expect(out).toBe('/d/1?var-test=val3');
  });
});

describe('__url_time_range', () => {
  beforeAll(() => {
    setTimeSrv({
      timeRangeForUrl: () => ({
        from: 1607687293000,
        to: 1607687293100,
      }),
    } as any);
  });

  it('should interpolate to url params', () => {
    const out = getTemplateSrv().replace(`/d/1?$${DataLinkBuiltInVars.keepTime}`);
    expect(out).toBe('/d/1?from=1607687293000&to=1607687293100');
  });
});
