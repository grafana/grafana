import { mapInternalLinkToExplore } from './dataLinks';
import { FieldType } from '../types';
import { ArrayVector } from '../vector';

describe('mapInternalLinkToExplore', () => {
  it('creates internal link', () => {
    const link = mapInternalLinkToExplore(
      {
        url: '',
        title: '',
        internal: {
          datasourceUid: 'uid',
          query: { query: '12344' },
        },
      },
      {},
      {} as any,
      {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: new ArrayVector([2]),
      },
      {
        replaceVariables: val => val,
        getDataSourceSettingsByUid: uid => ({ name: 'testDS' } as any),
      }
    );

    expect(link).toEqual(
      expect.objectContaining({
        title: 'testDS',
        href: '/explore?left={"datasource":"testDS","queries":[{"query":"12344"}]}',
        onClick: undefined,
      })
    );
  });
});
