import { DataLink, FieldType, TimeRange } from '../types';
import { ArrayVector } from '../vector';

import { mapInternalLinkToExplore, dataLinkHasAllVariablesDefined } from './dataLinks';

describe('dataLinks utils', () => {
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
          values: new ArrayVector([2]),
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
          values: new ArrayVector([2]),
        },
        replaceVariables: (val, scopedVars) => val.replace(/\$var/g, scopedVars!['var1'].value),
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

  describe('dataLinkHasAllVariablesDefined', () => {
    it('returns true when query contains variables and all variables are used', () => {
      const dataLink = {
        url: '',
        title: '',
        internal: {
          datasourceUid: 'uid',
          datasourceName: 'dsName',
          query: { query: 'test ${testVal}' },
        },
      };
      const scopedVars = {
        testVal: { text: '', value: 'val1' },
      };
      const varMapMock = jest.fn().mockReturnValue({ testVal: scopedVars.testVal.value });
      const dataLinkRtnVal = dataLinkHasAllVariablesDefined(dataLink, scopedVars, varMapMock).allVariablesDefined;

      expect(dataLinkRtnVal).toBe(true);
    });

    it('returns false when query contains variables and no variables are used', () => {
      const dataLink = {
        url: '',
        title: '',
        internal: {
          datasourceUid: 'uid',
          datasourceName: 'dsName',
          query: { query: 'test ${diffVar}' },
        },
      };
      const scopedVars = {
        testVal: { text: '', value: 'val1' },
      };
      const varMapMock = jest.fn().mockReturnValue({ diffVar: null });
      const dataLinkRtnVal = dataLinkHasAllVariablesDefined(dataLink, scopedVars, varMapMock).allVariablesDefined;

      expect(dataLinkRtnVal).toBe(false);
    });
    it('returns false when query contains variables and some variables are used', () => {
      const dataLink = {
        url: '',
        title: '',
        internal: {
          datasourceUid: 'uid',
          datasourceName: 'dsName',
          query: { query: 'test ${testVal} ${diffVar}' },
        },
      };
      const scopedVars = {
        testVal: { text: '', value: 'val1' },
      };
      const varMapMock = jest.fn().mockReturnValue({ testVal: 'val1', diffVar: null });
      const dataLinkRtnVal = dataLinkHasAllVariablesDefined(dataLink, scopedVars, varMapMock).allVariablesDefined;
      expect(dataLinkRtnVal).toBe(false);
    });

    it('returns true when query contains no variables', () => {
      const dataLink = {
        url: '',
        title: '',
        internal: {
          datasourceUid: 'uid',
          datasourceName: 'dsName',
          query: { query: 'test' },
        },
      };
      const scopedVars = {
        testVal: { text: '', value: 'val1' },
      };
      const varMapMock = jest.fn().mockReturnValue({});
      const dataLinkRtnVal = dataLinkHasAllVariablesDefined(dataLink, scopedVars, varMapMock).allVariablesDefined;
      expect(dataLinkRtnVal).toBe(true);
    });
  });
});
