import {
  ArrayVector,
  DataFrame,
  DataLink,
  dateTime,
  Field,
  FieldType,
  InterpolateFunction,
  LinkModel,
  TimeRange,
  toDataFrame,
} from '@grafana/data';
import { setTemplateSrv } from '@grafana/runtime';

import { initTemplateSrv } from '../../../../test/helpers/initTemplateSrv';
import { setContextSrv } from '../../../core/services/context_srv';
import { setLinkSrv } from '../../panel/panellinks/link_srv';

import { getFieldLinksForExplore } from './links';

describe('getFieldLinksForExplore', () => {
  beforeEach(() => {
    setTemplateSrv(
      initTemplateSrv('key', [
        { type: 'custom', name: 'emptyVar', current: { value: null } },
        { type: 'custom', name: 'num', current: { value: 1 } },
        { type: 'custom', name: 'test', current: { value: 'foo' } },
      ])
    );
  });

  it('returns correct link model for external link', () => {
    const { field, range } = setup({
      title: 'external',
      url: 'http://regionalhost',
    });
    const links = getFieldLinksForExplore({ field, rowIndex: 0, splitOpenFn: jest.fn(), range });

    expect(links[0].href).toBe('http://regionalhost');
    expect(links[0].title).toBe('external');
  });

  it('returns generates title for external link', () => {
    const { field, range } = setup({
      title: '',
      url: 'http://regionalhost',
    });
    const links = getFieldLinksForExplore({ field, rowIndex: 0, splitOpenFn: jest.fn(), range });

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
    const links = getFieldLinksForExplore({ field, rowIndex: 0, splitOpenFn: splitfn, range });

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
  });

  it('returns correct link model for external link when user does not have access to explore', () => {
    const { field, range } = setup(
      {
        title: 'external',
        url: 'http://regionalhost',
      },
      false
    );
    const links = getFieldLinksForExplore({ field, rowIndex: 0, range });

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
    const links = getFieldLinksForExplore({ field, rowIndex: 0, range });
    expect(links).toHaveLength(0);
  });

  it('returns internal links when target contains defined template variables', () => {
    const { field, range, dataFrame } = setup({
      title: '',
      url: '',
      internal: {
        query: { query: 'query_1-${__data.fields.flux-dimensions}' },
        datasourceUid: 'uid_1',
        datasourceName: 'test_ds',
      },
    });
    const links = getFieldLinksForExplore({ field, rowIndex: 0, range, dataFrame });
    expect(links).toHaveLength(1);
  });

  it('returns no internal links when target contains empty template variables', () => {
    const { field, range, dataFrame } = setup({
      title: '',
      url: '',
      internal: {
        query: { query: 'query_1-${__data.fields.flux-dimensions}' },
        datasourceUid: 'uid_1',
        datasourceName: 'test_ds',
      },
    });
    const links = getFieldLinksForExplore({ field, rowIndex: 1, range, dataFrame });
    expect(links).toHaveLength(0);
  });
});

const ROW_0_TEXT_VALUE = 'foo';
const ROW_1_NULL_VALUE = null;

function setup(link: DataLink, hasAccess = true) {
  setLinkSrv({
    getDataLinkUIModel(link: DataLink, replaceVariables: InterpolateFunction | undefined, origin: any): LinkModel<any> {
      return {
        href: link.url,
        title: link.title,
        target: '_blank',
        origin: origin,
      };
    },
    getAnchorInfo(link: any) {
      return { ...link };
    },
    getLinkUrl(link: any) {
      return link.url;
    },
  });

  setContextSrv({
    hasAccessToExplore: () => hasAccess,
  } as any);

  const field: Field<string | null> = {
    name: 'flux-dimensions',
    type: FieldType.string,
    values: new ArrayVector([ROW_0_TEXT_VALUE, ROW_1_NULL_VALUE]),
    config: {
      links: [link],
    },
  };

  const dataFrame: DataFrame = toDataFrame({
    fields: [field],
  });

  const range: TimeRange = {
    from: dateTime('2020-10-14T00:00:00'),
    to: dateTime('2020-10-14T01:00:00'),
    raw: {
      from: 'now-1h',
      to: 'now',
    },
  };

  return { range, field, dataFrame };
}
