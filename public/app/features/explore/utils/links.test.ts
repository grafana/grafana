import { getFieldLinksForExplore } from './links';
import {
  ArrayVector,
  DataLink,
  dateTime,
  Field,
  FieldType,
  InterpolateFunction,
  LinkModel,
  TimeRange,
} from '@grafana/data';
import { setLinkSrv } from '../../panel/panellinks/link_srv';
import { setContextSrv } from '../../../core/services/context_srv';

describe('getFieldLinksForExplore', () => {
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
      },
    });
    const splitfn = jest.fn();
    const links = getFieldLinksForExplore({ field, rowIndex: 0, splitOpenFn: splitfn, range });

    expect(links[0].href).toBe(
      '/explore?left={"range":{"from":"now-1h","to":"now"},"datasource":"test_ds","queries":[{"query":"query_1"}]}'
    );
    expect(links[0].title).toBe('test_ds');

    if (links[0].onClick) {
      links[0].onClick({});
    }

    expect(splitfn).toBeCalledWith({
      datasourceUid: 'uid_1',
      query: { query: 'query_1' },
      range,
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
});

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

  const field: Field<string> = {
    name: 'flux-dimensions',
    type: FieldType.string,
    values: new ArrayVector([]),
    config: {
      links: [link],
    },
  };

  const range: TimeRange = {
    from: dateTime('2020-10-14T00:00:00'),
    to: dateTime('2020-10-14T01:00:00'),
    raw: {
      from: 'now-1h',
      to: 'now',
    },
  };

  return { range, field };
}
