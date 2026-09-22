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

    const query = {
      query: 'val1 val1',
      $var: 'foo',
      nested: { something: 'val1' },
      num: 1,
      arr: ['val1', 'non var'],
      datasource: { uid: 'uid' },
    };

    expect(decodeURIComponent(link.href)).toEqual(
      `/explore?left=${JSON.stringify({
        range: {
          from: DATE_AS_MS,
          to: DATE_AS_MS,
        },
        datasource: 'uid',
        queries: [query],
      })}`
    );

    expect(link.interpolatedParams?.query).toEqual({
      ...query,
    });

    expect(link.interpolatedParams?.timeRange).toEqual(TIME_RANGE);
  });

  it('calls onClickFn with the original interpolated query', () => {
    const onClickFn = jest.fn();
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
      range: TIME_RANGE,
      field: {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: [2],
      },
      replaceVariables: (val) => val,
      onClickFn,
    });

    const event = { preventDefault: jest.fn() };
    link.onClick?.(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onClickFn).toHaveBeenCalledWith({
      datasourceUid: 'uid',
      queries: [
        {
          query: '12344',
          datasource: { uid: 'uid' },
        },
      ],
      panelsState: undefined,
      correlationHelperData: undefined,
      range: TIME_RANGE,
    });
  });

  it('reads query and datasource from interpolatedParams at click time after they are rewritten', () => {
    const onClickFn = jest.fn();
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
      onClickFn,
    });

    const rewrittenQuery = {
      refId: 'test',
      query: '{job="api"}',
      datasource: { uid: 'loki-uid', type: 'loki' },
    };
    if (link.interpolatedParams) {
      link.interpolatedParams.query = rewrittenQuery;
    }

    link.onClick?.({ preventDefault: jest.fn() });

    expect(onClickFn).toHaveBeenCalledWith({
      datasourceUid: 'loki-uid',
      queries: [rewrittenQuery],
      panelsState: undefined,
      correlationHelperData: undefined,
      range: undefined,
    });
  });
});
