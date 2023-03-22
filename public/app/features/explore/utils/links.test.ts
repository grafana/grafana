import {
  ArrayVector,
  DataFrame,
  DataLink,
  DataLinkConfigOrigin,
  dateTime,
  Field,
  FieldType,
  InterpolateFunction,
  SupportedTransformationTypes,
  TimeRange,
  toDataFrame,
} from '@grafana/data';
import { setTemplateSrv, reportInteraction } from '@grafana/runtime';

import { initTemplateSrv } from '../../../../test/helpers/initTemplateSrv';
import { ContextSrv, setContextSrv } from '../../../core/services/context_srv';
import { setLinkSrv } from '../../panel/panellinks/link_srv';

import { getFieldLinksForExplore, getVariableUsageInfo } from './links';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('explore links utils', () => {
  describe('getFieldLinksForExplore', () => {
    beforeEach(() => {
      setTemplateSrv(
        initTemplateSrv('key', [
          { type: 'custom', name: 'emptyVar', current: { value: null } },
          { type: 'custom', name: 'num', current: { value: 1 } },
          { type: 'custom', name: 'test', current: { value: 'foo' } },
        ])
      );

      window.open = jest.fn();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('returns correct link model for external link', () => {
      const { field, range } = setup({
        title: 'external',
        url: 'http://regionalhost',
      });
      const links = getFieldLinksForExplore({
        field,
        rowIndex: ROW_WITH_TEXT_VALUE.index,
        splitOpenFn: jest.fn(),
        range,
      });

      expect(links[0].href).toBe('http://regionalhost');
      expect(links[0].title).toBe('external');
      expect(links[0].onClick).toBeDefined();

      if (links[0].onClick) {
        links[0].onClick({});
      }

      expect(reportInteraction).toBeCalledWith('grafana_data_link_clicked', {
        app: 'explore',
        internal: false,
        origin: 'Datasource',
      });
    });

    it('returns generates title for external link', () => {
      const { field, range } = setup({
        title: '',
        url: 'http://regionalhost',
      });
      const links = getFieldLinksForExplore({
        field,
        rowIndex: ROW_WITH_TEXT_VALUE.index,
        splitOpenFn: jest.fn(),
        range,
      });

      expect(links[0].href).toBe('http://regionalhost');
      expect(links[0].title).toBe('regionalhost');
    });

    it('returns correct link model for internal link', () => {
      const { field, range } = setup({
        title: '',
        url: '',
        internal: {
          query: { query: 'query_1' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
          panelsState: {
            trace: {
              spanId: 'abcdef',
            },
          },
        },
      });
      const splitfn = jest.fn();
      const links = getFieldLinksForExplore({
        field,
        rowIndex: ROW_WITH_TEXT_VALUE.index,
        splitOpenFn: splitfn,
        range,
      });

      expect(links[0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"query_1"}],"panelsState":{"trace":{"spanId":"abcdef"}}}'
        )}`
      );
      expect(links[0].title).toBe('test_ds');

      if (links[0].onClick) {
        links[0].onClick({});
      }

      expect(splitfn).toBeCalledWith({
        datasourceUid: 'uid_1',
        query: { query: 'query_1' },
        range,
        panelsState: {
          trace: {
            spanId: 'abcdef',
          },
        },
      });

      expect(reportInteraction).toBeCalledWith('grafana_data_link_clicked', {
        app: 'explore',
        internal: true,
        origin: 'Datasource',
      });
    });

    it('returns correct link model for external link when user does not have access to explore', () => {
      const { field, range } = setup(
        {
          title: 'external',
          url: 'http://regionalhost',
        },
        false
      );
      const links = getFieldLinksForExplore({ field, rowIndex: ROW_WITH_TEXT_VALUE.index, range });

      expect(links[0].href).toBe('http://regionalhost');
      expect(links[0].title).toBe('external');
    });

    it('returns no internal links if when user does not have access to explore', () => {
      const { field, range } = setup(
        {
          title: '',
          url: '',
          internal: {
            query: { query: 'query_1' },
            datasourceUid: 'uid_1',
            datasourceName: 'test_ds',
          },
        },
        false
      );
      const links = getFieldLinksForExplore({ field, rowIndex: ROW_WITH_TEXT_VALUE.index, range });
      expect(links).toHaveLength(0);
    });

    it('returns internal links when target contains __data template variables', () => {
      const { field, range, dataFrame } = setup({
        title: '',
        url: '',
        internal: {
          query: { query: 'query_1-${__data.fields.flux-dimensions}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
        },
      });
      const links = getFieldLinksForExplore({ field, rowIndex: ROW_WITH_TEXT_VALUE.index, range, dataFrame });
      expect(links).toHaveLength(1);
      expect(links[0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"query_1-foo"}]}'
        )}`
      );
    });

    it('returns internal links when target contains targetField template variable', () => {
      const { field, range, dataFrame } = setup({
        title: '',
        url: '',
        internal: {
          query: { query: 'query_1-${__targetField}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
        },
      });
      const links = getFieldLinksForExplore({ field, rowIndex: ROW_WITH_TEXT_VALUE.index, range, dataFrame });
      expect(links).toHaveLength(1);
      expect(links[0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"query_1-foo"}]}'
        )}`
      );
    });

    it('returns internal links when target contains field name template variable', () => {
      // field cannot be hyphenated, change field name to non-hyphenated
      const noHyphenLink = {
        title: '',
        url: '',
        internal: {
          query: { query: 'query_1-${fluxDimensions}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
        },
      };
      const { field, range, dataFrame } = setup(noHyphenLink, true, {
        name: 'fluxDimensions',
        type: FieldType.string,
        values: new ArrayVector([ROW_WITH_TEXT_VALUE.value, ROW_WITH_NULL_VALUE.value]),
        config: {
          links: [noHyphenLink],
        },
      });
      const links = getFieldLinksForExplore({ field, rowIndex: ROW_WITH_TEXT_VALUE.index, range, dataFrame });
      expect(links).toHaveLength(1);
      expect(links[0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"query_1-foo"}]}'
        )}`
      );
    });

    it('returns internal links when target contains other field name template variables', () => {
      // field cannot be hyphenated, change field name to non-hyphenated
      const noHyphenLink = {
        title: '',
        url: '',
        internal: {
          query: { query: 'query_1-${fluxDimensions}-${fluxDimension2}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
        },
      };
      const { field, range, dataFrame } = setup(
        noHyphenLink,
        true,
        {
          name: 'fluxDimensions',
          type: FieldType.string,
          values: new ArrayVector([ROW_WITH_TEXT_VALUE.value, ROW_WITH_NULL_VALUE.value]),
          config: {
            links: [noHyphenLink],
          },
        },
        [
          {
            name: 'fluxDimension2',
            type: FieldType.string,
            values: new ArrayVector(['foo2', ROW_WITH_NULL_VALUE.value]),
            config: {
              links: [noHyphenLink],
            },
          },
        ]
      );
      const links = getFieldLinksForExplore({ field, rowIndex: ROW_WITH_TEXT_VALUE.index, range, dataFrame });
      expect(links).toHaveLength(1);
      expect(links[0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"query_1-foo-foo2"}]}'
        )}`
      );
    });

    it('returns internal links with logfmt and regex transformation', () => {
      const transformationLink: DataLink = {
        title: '',
        url: '',
        origin: DataLinkConfigOrigin.Correlations,
        internal: {
          query: { query: 'http_requests{app=${application} env=${environment}}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
          transformations: [
            { type: SupportedTransformationTypes.Logfmt },
            { type: SupportedTransformationTypes.Regex, expression: 'host=(dev|prod)', mapValue: 'environment' },
          ],
        },
      };

      const { field, range, dataFrame } = setup(transformationLink, true, {
        name: 'msg',
        type: FieldType.string,
        values: new ArrayVector(['application=foo host=dev-001', 'application=bar host=prod-003']),
        config: {
          links: [transformationLink],
        },
      });

      const links = [
        getFieldLinksForExplore({ field, rowIndex: 0, range, dataFrame }),
        getFieldLinksForExplore({ field, rowIndex: 1, range, dataFrame }),
      ];
      expect(links[0]).toHaveLength(1);
      expect(links[0][0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{app=foo env=dev}"}]}'
        )}`
      );

      if (links[0][0].onClick) {
        links[0][0].onClick({});
      }

      expect(reportInteraction).toBeCalledWith('grafana_data_link_clicked', {
        app: 'explore',
        internal: true,
        origin: 'Correlations',
      });

      expect(links[1]).toHaveLength(1);
      expect(links[1][0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{app=bar env=prod}"}]}'
        )}`
      );
    });

    it('returns internal links with 2 unnamed regex transformations and use the last transformation', () => {
      const transformationLink: DataLink = {
        title: '',
        url: '',
        internal: {
          query: { query: 'http_requests{env=${msg}}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
          transformations: [
            { type: SupportedTransformationTypes.Regex, expression: 'fieldA=(asparagus|broccoli)' },
            { type: SupportedTransformationTypes.Regex, expression: 'fieldB=(apple|banana)' },
          ],
        },
      };

      const { field, range, dataFrame } = setup(transformationLink, true, {
        name: 'msg',
        type: FieldType.string,
        values: new ArrayVector(['fieldA=asparagus fieldB=banana', 'fieldA=broccoli fieldB=apple']),
        config: {
          links: [transformationLink],
        },
      });

      const links = [
        getFieldLinksForExplore({ field, rowIndex: 0, range, dataFrame }),
        getFieldLinksForExplore({ field, rowIndex: 1, range, dataFrame }),
      ];
      expect(links[0]).toHaveLength(1);
      expect(links[0][0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{env=banana}"}]}'
        )}`
      );
      expect(links[1]).toHaveLength(1);
      expect(links[1][0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{env=apple}"}]}'
        )}`
      );
    });

    it('returns internal links with logfmt with stringified booleans', () => {
      const transformationLink: DataLink = {
        title: '',
        url: '',
        internal: {
          query: { query: 'http_requests{app=${application} isOnline=${online}}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
          transformations: [{ type: SupportedTransformationTypes.Logfmt }],
        },
      };

      const { field, range, dataFrame } = setup(transformationLink, true, {
        name: 'msg',
        type: FieldType.string,
        values: new ArrayVector(['application=foo online=true', 'application=bar online=false']),
        config: {
          links: [transformationLink],
        },
      });

      const links = [
        getFieldLinksForExplore({ field, rowIndex: 0, range, dataFrame }),
        getFieldLinksForExplore({ field, rowIndex: 1, range, dataFrame }),
      ];
      expect(links[0]).toHaveLength(1);
      expect(links[0][0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{app=foo isOnline=true}"}]}'
        )}`
      );
      expect(links[1]).toHaveLength(1);
      expect(links[1][0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{app=bar isOnline=false}"}]}'
        )}`
      );
    });

    it('returns internal links with logfmt with correct data on transformation-defined field', () => {
      const transformationLink: DataLink = {
        title: '',
        url: '',
        internal: {
          query: { query: 'http_requests{app=${application}}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
          transformations: [{ type: SupportedTransformationTypes.Logfmt, field: 'fieldNamedInTransformation' }],
        },
      };

      // fieldWithLink has the transformation, but the transformation has defined fieldNamedInTransformation as its field to transform
      const { field, range, dataFrame } = setup(
        transformationLink,
        true,
        {
          name: 'fieldWithLink',
          type: FieldType.string,
          values: new ArrayVector(['application=link', 'application=link2']),
          config: {
            links: [transformationLink],
          },
        },
        [
          {
            name: 'fieldNamedInTransformation',
            type: FieldType.string,
            values: new ArrayVector(['application=transform', 'application=transform2']),
            config: {},
          },
        ]
      );

      const links = [
        getFieldLinksForExplore({ field, rowIndex: 0, range, dataFrame }),
        getFieldLinksForExplore({ field, rowIndex: 1, range, dataFrame }),
      ];
      expect(links[0]).toHaveLength(1);
      expect(links[0][0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{app=transform}"}]}'
        )}`
      );
      expect(links[1]).toHaveLength(1);
      expect(links[1][0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{app=transform2}"}]}'
        )}`
      );
    });

    it('returns internal links with regex named capture groups', () => {
      const transformationLink: DataLink = {
        title: '',
        url: '',
        internal: {
          query: { query: 'http_requests{app=${application} env=${environment}}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
          transformations: [
            {
              type: SupportedTransformationTypes.Regex,
              expression: '(?=.*(?<application>(grafana|loki)))(?=.*(?<environment>(dev|prod)))',
            },
          ],
        },
      };

      const { field, range, dataFrame } = setup(transformationLink, true, {
        name: 'msg',
        type: FieldType.string,
        values: new ArrayVector(['foo loki prod', 'dev bar grafana', 'prod grafana foo']),
        config: {
          links: [transformationLink],
        },
      });

      const links = [
        getFieldLinksForExplore({ field, rowIndex: 0, range, dataFrame }),
        getFieldLinksForExplore({ field, rowIndex: 1, range, dataFrame }),
        getFieldLinksForExplore({ field, rowIndex: 2, range, dataFrame }),
      ];
      expect(links[0]).toHaveLength(1);
      expect(links[0][0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{app=loki env=prod}"}]}'
        )}`
      );
      expect(links[1]).toHaveLength(1);
      expect(links[1][0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{app=grafana env=dev}"}]}'
        )}`
      );

      expect(links[2]).toHaveLength(1);
      expect(links[2][0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{app=grafana env=prod}"}]}'
        )}`
      );
    });

    it('returns internal links for non-existing fields accessed with __data.fields', () => {
      const { field, range, dataFrame } = setup({
        title: '',
        url: '',
        internal: {
          query: { query: 'query_1-${__data.fields.flux-dimensions}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
        },
      });
      const links = getFieldLinksForExplore({ field, rowIndex: ROW_WITH_NULL_VALUE.index, range, dataFrame });
      expect(links).toHaveLength(1);
    });

    it('returns no internal links when target contains empty template variables', () => {
      const { field, range, dataFrame } = setup({
        title: '',
        url: '',
        internal: {
          query: { query: 'query_1-${mementoMori}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
        },
      });
      const links = getFieldLinksForExplore({ field, rowIndex: ROW_WITH_NULL_VALUE.index, range, dataFrame });
      expect(links).toHaveLength(0);
    });

    it('does not return internal links when not all query variables are matched', () => {
      const transformationLink: DataLink = {
        title: '',
        url: '',
        internal: {
          query: { query: 'http_requests{app=${application} env=${diffVar}}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
          transformations: [{ type: SupportedTransformationTypes.Logfmt }],
        },
      };

      const { field, range, dataFrame } = setup(transformationLink, true, {
        name: 'msg',
        type: FieldType.string,
        values: new ArrayVector(['application=foo host=dev-001']),
        config: {
          links: [transformationLink],
        },
      });

      const links = [getFieldLinksForExplore({ field, rowIndex: 0, range, dataFrame })];
      expect(links[0]).toHaveLength(0);
    });

    it('does return internal link when there are no variables (static link)', () => {
      const transformationLink: DataLink = {
        title: '',
        url: '',
        internal: {
          query: { query: 'http_requests{app=test}' },
          datasourceUid: 'uid_1',
          datasourceName: 'test_ds',
          transformations: [{ type: SupportedTransformationTypes.Logfmt }],
        },
      };

      const { field, range, dataFrame } = setup(transformationLink, true, {
        name: 'msg',
        type: FieldType.string,
        values: new ArrayVector(['application=foo host=dev-001']),
        config: {
          links: [transformationLink],
        },
      });

      const links = getFieldLinksForExplore({ field, rowIndex: 0, range, dataFrame });
      expect(links).toHaveLength(1);
      expect(links[0].variables?.length).toBe(1);
      expect(links[0].variables![0].variableName).toBe('msg');
      expect(links[0].variables![0].value).toBe('');
      expect(links[0].href).toBe(
        `/explore?left=${encodeURIComponent(
          '{"range":{"from":"now-1h","to":"now"},"datasource":"uid_1","queries":[{"query":"http_requests{app=test}"}]}'
        )}`
      );
    });
  });

  describe('getVariableUsageInfo', () => {
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
      const dataLinkRtnVal = getVariableUsageInfo(dataLink, scopedVars).allVariablesDefined;

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
      const dataLinkRtnVal = getVariableUsageInfo(dataLink, scopedVars).allVariablesDefined;

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
      const dataLinkRtnVal = getVariableUsageInfo(dataLink, scopedVars).allVariablesDefined;
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
      const dataLinkRtnVal = getVariableUsageInfo(dataLink, scopedVars).allVariablesDefined;
      expect(dataLinkRtnVal).toBe(true);
    });
  });
});

const ROW_WITH_TEXT_VALUE = { value: 'foo', index: 0 };
const ROW_WITH_NULL_VALUE = { value: null, index: 1 };

function setup(
  link: DataLink,
  hasAccess = true,
  fieldOverride?: Field<string | null>,
  dataFrameOtherFieldOverride?: Field[]
) {
  setLinkSrv({
    getDataLinkUIModel(link: DataLink, replaceVariables: InterpolateFunction | undefined, origin) {
      return {
        href: link.url,
        title: link.title,
        target: '_blank',
        origin: origin,
      };
    },
    getAnchorInfo(link) {
      return { ...link };
    },
    getLinkUrl(link) {
      return link.url;
    },
  });

  setContextSrv({
    hasAccessToExplore: () => hasAccess,
  } as ContextSrv);

  const field: Field<string | null> = {
    name: 'flux-dimensions',
    type: FieldType.string,
    values: new ArrayVector([ROW_WITH_TEXT_VALUE.value, ROW_WITH_NULL_VALUE.value]),
    config: {
      links: [link],
    },
  };

  let fieldsArr = [fieldOverride || field];

  if (dataFrameOtherFieldOverride) {
    fieldsArr = [...fieldsArr, ...dataFrameOtherFieldOverride];
  }

  const dataFrame: DataFrame = toDataFrame({
    fields: fieldsArr,
  });

  const range: TimeRange = {
    from: dateTime('2020-10-14T00:00:00'),
    to: dateTime('2020-10-14T01:00:00'),
    raw: {
      from: 'now-1h',
      to: 'now',
    },
  };

  return { range, field: fieldOverride || field, dataFrame };
}
