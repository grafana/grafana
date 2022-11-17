import { dateTime } from '../datetime';
import { DataLink, FieldType } from '../types';
import { ArrayVector } from '../vector';

import { mapInternalLinkToExplore } from './dataLinks';

const mockTimeRange = {
  from: dateTime(0),
  to: dateTime(1000),
  raw: {
    from: dateTime(0),
    to: dateTime(1000),
  },
};
const serializedRange = '{"from":"1970-01-01T00:00:00.000Z","to":"1970-01-01T00:00:01.000Z"}';

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
      range: mockTimeRange,
      field: {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: new ArrayVector([2]),
      },
      replaceVariables: (val) => val,
    });

    expect(link).toEqual(
      expect.objectContaining({
        title: 'dsName',
        href: `/explore?left=${encodeURIComponent(
          `{"range":${serializedRange},"datasource":"uid","queries":[{"query":"12344"}],"panelsState":{}}`
        )}`,
        onClick: undefined,
        containsTemplate: undefined,
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
      range: mockTimeRange,
      field: {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: new ArrayVector([2]),
      },
      replaceVariables: (val) => val,
    });

    expect(link).toEqual(
      expect.objectContaining({
        title: 'dsName',
        href: `/explore?left=${encodeURIComponent(
          `{"range":${serializedRange},"datasource":"uid","queries":[{"query":"12344"}],"panelsState":{"trace":{"spanId":"abcdef"}}}`
        )}`,
        onClick: undefined,
      })
    );
  });

  it('passed containsTemplate to link model', () => {
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
      range: mockTimeRange,
      field: {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: new ArrayVector([2]),
      },
      replaceVariables: (val) => val,
      containsTemplate: () => true,
    });

    expect(link).toEqual(
      expect.objectContaining({
        title: 'dsName',
        href: `/explore?left=${encodeURIComponent(
          `{"range":${serializedRange},"datasource":"uid","queries":[{"query":"12344"}],"panelsState":{}}`
        )}`,
        onClick: undefined,
        containsTemplate: true,
      })
    );
  });
});
