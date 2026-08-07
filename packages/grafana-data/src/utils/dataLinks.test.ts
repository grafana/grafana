import { type DateTime, toUtc } from '../datetime/moment_wrapper';
import { FieldType } from '../types/dataFrame';
import { type DataLink } from '../types/dataLink';
import { type TimeRange } from '../types/time';

import { mapInternalLinkToExplore } from './dataLinks';

const createTimeRange = (from: DateTime, to: DateTime): TimeRange => ({
  from,
  to,
  raw: {
    from,
    to,
  },
});

const DATE_AS_DATE_TIME = toUtc([2000, 1, 1]);
const DATE_AS_MS = '949363200000';
const TIME_RANGE = createTimeRange(DATE_AS_DATE_TIME, DATE_AS_DATE_TIME);

const fullQuery = {
  query: 'val1 val1',
  $var: 'foo',
  nested: { something: 'val1' },
  num: 1,
  arr: ['val1', 'non var'],
  datasource: { uid: 'uid' },
};

const minQuery = {
  datasource: { uid: 'uid' },
};

describe('mapInternalLinkToExplore', () => {
  it('creates internal link', () => {
    const dataLink = {
      url: '',
      title: '',
      internal: {
        datasourceUid: 'uid',
        datasourceName: 'dsName',
        query: { query: '12344' },
      },
    };

    const link = mapInternalLinkToExplore({
      link: dataLink,
      internalLink: dataLink.internal,
      scopedVars: {},
      field: {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: [2],
      },
      replaceVariables: (val) => val,
    });

    expect(link).toEqual(
      expect.objectContaining({
        title: 'dsName',
        href: `/explore?left=${encodeURIComponent('{"datasource":"uid","queries":[{"query":"12344","datasource":{"uid":"uid"}}]}')}`,
        onClick: undefined,
        interpolatedParams: {
          query: {
            query: '12344',
            datasource: {
              uid: 'uid',
            },
          },
        },
      })
    );
  });

  it('includes panels state', () => {
    const panelsState = {
      trace: {
        spanId: 'abcdef',
      },
    };

    const dataLink: DataLink = {
      url: '',
      title: '',
      internal: {
        datasourceUid: 'uid',
        datasourceName: 'dsName',
        query: { query: '12344' },
        panelsState,
      },
    };

    const link = mapInternalLinkToExplore({
      link: dataLink,
      internalLink: dataLink.internal!,
      scopedVars: {},
      field: {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: [2],
      },
      replaceVariables: (val) => val,
    });

    expect(link).toEqual(
      expect.objectContaining({
        title: 'dsName',
        href: `/explore?left=${encodeURIComponent(
          '{"datasource":"uid","queries":[{"query":"12344","datasource":{"uid":"uid"}}],"panelsState":{"trace":{"spanId":"abcdef"}}}'
        )}`,
        onClick: undefined,
      })
    );
  });

  it('interpolates query correctly', () => {
    const dataLink = {
      url: '',
      title: '',
      internal: {
        datasourceUid: 'uid',
        datasourceName: 'dsName',
        query: {
          query: '$var $var',
          // Should not interpolate keys
          $var: 'foo',
          nested: {
            something: '$var',
          },
          num: 1,
          arr: ['$var', 'non var'],
        },
      },
    };

    const link = mapInternalLinkToExplore({
      link: dataLink,
      internalLink: dataLink.internal,
      scopedVars: {
        var1: { text: '', value: 'val1' },
      },
      range: TIME_RANGE,
      field: {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: [2],
      },
      replaceVariables: (val, scopedVars) => val.replace(/\$var/g, scopedVars!['var1']!.value),
    });

    expect(decodeURIComponent(link.href)).toEqual(
      `/explore?left=${JSON.stringify({
        range: {
          from: DATE_AS_MS,
          to: DATE_AS_MS,
        },
        datasource: 'uid',
        queries: [fullQuery],
      })}`
    );

    expect(link.interpolatedParams?.query).toEqual({
      ...fullQuery,
    });

    expect(link.interpolatedParams?.timeRange).toEqual(TIME_RANGE);
  });

  const dataLink = {
    url: '',
    title: '',
    internal: {
      datasourceUid: 'uid',
      datasourceName: 'dsName',
      query: {},
    },
    meta: {},
  };

  const timeRangeTests = [
    {
      scenario: 'unix format, default offset',
      timeRange: { field: 'time' },
      varValue: { numeric: 1781284509077, text: '1781284509077' },
      expectedFromMS: '1781280909077',
      expectedToMS: '1781288109077',
      expectedTimeRange: {
        raw: { from: '2026-06-12T16:15:09.077Z', to: '2026-06-12T18:15:09.077Z' },
      },
    },
    {
      scenario: 'YYYY-MM-DD format, default offset',
      timeRange: { field: 'time' },
      varValue: { numeric: 1781288092273, text: '2026-06-12 13:14:52' },
      expectedFromMS: '1781284492273',
      expectedToMS: '1781291692273',
      expectedTimeRange: {
        raw: { from: '2026-06-12T17:14:52.273Z', to: '2026-06-12T19:14:52.273Z' },
      },
    },
    {
      scenario: 'no field, +-24h offset',
      timeRange: { range: { from: 86400, to: -86400 } },
      expectedFromMS: '1781456640000',
      expectedToMS: '1781629440000',
      expectedTimeRange: {
        raw: { from: '2026-06-14T17:04:00.000Z', to: '2026-06-16T17:04:00.000Z' },
      },
    },
    {
      scenario: 'unix format, +-24h offset',
      timeRange: { field: 'time', range: { from: 86400, to: -86400 } },
      varValue: { numeric: 1781284509077, text: '1781284509077' },
      expectedFromMS: '1781198109077',
      expectedToMS: '1781370909077',
      expectedTimeRange: {
        raw: { from: '2026-06-11T17:15:09.077Z', to: '2026-06-13T17:15:09.077Z' },
      },
    },
  ];

  it.each(timeRangeTests)(
    'interpolates timeRange successfully for $scenario',
    ({ timeRange, varValue, expectedFromMS, expectedToMS, expectedTimeRange }) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-15T17:04:00.000Z'));
      jest.spyOn(console, 'warn').mockImplementation(); // ignore date conversion warnings
      const dataLinkWithTimeRange = { ...dataLink, meta: { timeRange: timeRange } };
      const link = mapInternalLinkToExplore({
        link: dataLinkWithTimeRange,
        internalLink: dataLinkWithTimeRange.internal,
        scopedVars: {
          var1: { text: '', value: 'val1' },
          time: { text: '', value: varValue },
        },
        range: TIME_RANGE,
        field: {
          name: 'test',
          type: FieldType.number,
          config: {},
          values: [2],
        },
        replaceVariables: (val, scopedVars) => {
          return val.replace(/\${time}/g, scopedVars!['time']!.value?.numeric ?? '');
        },
      });

      expect(decodeURIComponent(link.href)).toEqual(
        `/explore?left=${JSON.stringify({
          range: {
            from: expectedFromMS,
            to: expectedToMS,
          },
          datasource: 'uid',
          queries: [minQuery],
        })}`
      );

      expect(JSON.stringify(link.interpolatedParams?.timeRange!.raw)).toEqual(JSON.stringify(expectedTimeRange.raw));
      jest.useRealTimers();
    }
  );
});
