import { DataLink, FieldType } from '../types';
import { ArrayVector } from '../vector';

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
      range: {} as any,
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
          '{"datasource":"uid","queries":[{"query":"12344"}],"panelsState":{}}'
        )}`,
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
      range: {} as any,
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
          '{"datasource":"uid","queries":[{"query":"12344"}],"panelsState":{"trace":{"spanId":"abcdef"}}}'
        )}`,
        onClick: undefined,
      })
    );
  });
});
