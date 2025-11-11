import { TimeRange } from '@grafana/data';

import { buildParams } from './utils';

describe('buildParams', () => {
  it.each`
    search                                         | useCurrentTimeRange | selectedTheme | panelId      | expected
    ${''}                                          | ${true}             | ${'current'}  | ${undefined} | ${'from=1000&to=2000&orgId=2'}
    ${''}                                          | ${true}             | ${'current'}  | ${'3'}       | ${'from=1000&to=2000&orgId=2&viewPanel=3'}
    ${''}                                          | ${true}             | ${'light'}    | ${undefined} | ${'from=1000&to=2000&orgId=2&theme=light'}
    ${''}                                          | ${true}             | ${'light'}    | ${'3'}       | ${'from=1000&to=2000&orgId=2&theme=light&viewPanel=3'}
    ${''}                                          | ${false}            | ${'current'}  | ${undefined} | ${'orgId=2'}
    ${''}                                          | ${false}            | ${'current'}  | ${'3'}       | ${'orgId=2&viewPanel=3'}
    ${''}                                          | ${false}            | ${'light'}    | ${undefined} | ${'orgId=2&theme=light'}
    ${''}                                          | ${false}            | ${'light'}    | ${'3'}       | ${'orgId=2&theme=light&viewPanel=3'}
    ${'editPanel=4'}                               | ${true}             | ${'current'}  | ${undefined} | ${'editPanel=4&from=1000&to=2000&orgId=2'}
    ${'editPanel=4'}                               | ${true}             | ${'current'}  | ${'3'}       | ${'editPanel=4&from=1000&to=2000&orgId=2'}
    ${'editPanel=4'}                               | ${true}             | ${'light'}    | ${undefined} | ${'editPanel=4&from=1000&to=2000&orgId=2&theme=light'}
    ${'editPanel=4'}                               | ${true}             | ${'light'}    | ${'3'}       | ${'editPanel=4&from=1000&to=2000&orgId=2&theme=light'}
    ${'editPanel=4'}                               | ${false}            | ${'current'}  | ${undefined} | ${'editPanel=4&orgId=2'}
    ${'editPanel=4'}                               | ${false}            | ${'current'}  | ${'3'}       | ${'editPanel=4&orgId=2'}
    ${'editPanel=4'}                               | ${false}            | ${'light'}    | ${undefined} | ${'editPanel=4&orgId=2&theme=light'}
    ${'editPanel=4'}                               | ${false}            | ${'light'}    | ${'3'}       | ${'editPanel=4&orgId=2&theme=light'}
    ${'var=%2B1&var=a+value+with+spaces&var=true'} | ${true}             | ${'current'}  | ${undefined} | ${'var=%2B1&var=a+value+with+spaces&var=true&from=1000&to=2000&orgId=2'}
    ${'var=%2B1&var=a+value+with+spaces&var=true'} | ${true}             | ${'current'}  | ${'3'}       | ${'var=%2B1&var=a+value+with+spaces&var=true&from=1000&to=2000&orgId=2&viewPanel=3'}
    ${'var=%2B1&var=a+value+with+spaces&var=true'} | ${true}             | ${'light'}    | ${undefined} | ${'var=%2B1&var=a+value+with+spaces&var=true&from=1000&to=2000&orgId=2&theme=light'}
    ${'var=%2B1&var=a+value+with+spaces&var=true'} | ${true}             | ${'light'}    | ${'3'}       | ${'var=%2B1&var=a+value+with+spaces&var=true&from=1000&to=2000&orgId=2&theme=light&viewPanel=3'}
    ${'var=%2B1&var=a+value+with+spaces&var=true'} | ${false}            | ${'current'}  | ${undefined} | ${'var=%2B1&var=a+value+with+spaces&var=true&orgId=2'}
    ${'var=%2B1&var=a+value+with+spaces&var=true'} | ${false}            | ${'current'}  | ${'3'}       | ${'var=%2B1&var=a+value+with+spaces&var=true&orgId=2&viewPanel=3'}
    ${'var=%2B1&var=a+value+with+spaces&var=true'} | ${false}            | ${'light'}    | ${undefined} | ${'var=%2B1&var=a+value+with+spaces&var=true&orgId=2&theme=light'}
    ${'var=%2B1&var=a+value+with+spaces&var=true'} | ${false}            | ${'light'}    | ${'3'}       | ${'var=%2B1&var=a+value+with+spaces&var=true&orgId=2&theme=light&viewPanel=3'}
    ${'auth_token=1234'}                           | ${true}             | ${'current'}  | ${undefined} | ${'from=1000&to=2000&orgId=2'}
  `(
    "when called with search: '$search' and useCurrentTimeRange: '$useCurrentTimeRange' and selectedTheme: '$selectedTheme' and panel: '$panel'then result should be '$expected'",
    ({ search, useCurrentTimeRange, selectedTheme, panelId, expected }) => {
      const range: TimeRange = {
        from: 1000,
        to: 2000,
        raw: { from: 'now-6h', to: 'now' },
      } as unknown as TimeRange;
      const orgId = 2;
      const result = buildParams({ useCurrentTimeRange, selectedTheme, panelId, search, range, orgId });

      expect(result.toString()).toEqual(expected);
    }
  );
});
