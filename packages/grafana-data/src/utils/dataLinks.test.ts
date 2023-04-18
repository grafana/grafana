import { DataLink, FieldType, TimeRange } from '../types';

import { mapInternalLinkToExplore } from './dataLinks';

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
      range: {} as unknown as TimeRange,
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
        href: `/explore?left=${encodeURIComponent('{"datasource":"uid","queries":[{"query":"12344"}]}')}`,
        onClick: undefined,
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
      range: {} as unknown as TimeRange,
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
          '{"datasource":"uid","queries":[{"query":"12344"}],"panelsState":{"trace":{"spanId":"abcdef"}}}'
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
      range: {} as unknown as TimeRange,
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
        datasource: 'uid',
        queries: [
          {
            query: 'val1 val1',
            $var: 'foo',
            nested: { something: 'val1' },
            num: 1,
            arr: ['val1', 'non var'],
          },
        ],
      })}`
    );
  });
});
