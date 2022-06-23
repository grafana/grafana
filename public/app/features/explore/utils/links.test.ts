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
import { setTemplateSrv } from '@grafana/runtime';

import { setContextSrv } from '../../../core/services/context_srv';
import { setLinkSrv } from '../../panel/panellinks/link_srv';

import { getFieldLinksForExplore } from './links';

describe('getFieldLinksForExplore', () => {
  beforeEach(() => {
    setTemplateSrv({
      replace(target, scopedVars, format) {
        return target ?? '';
      },
      getVariables() {
        return [];
      },
      containsTemplate() {
        return false;
      },
      updateTimeRange(timeRange: TimeRange) {},
    });
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
      '/explore?left=%257B%2522range%2522%253A%257B%2522from%2522%253A%2522now-1h%2522%252C%2522to%2522%253A%2522now' +
        '%2522%257D%252C%2522datasource%2522%253A%2522test_ds%2522%252C%2522queries%2522%253A%255B%257B%2522query%2522' +
        '%253A%2522query_1%2522%257D%255D%252C%2522panelsState%2522%253A%257B%2522trace%2522%253A%257B%2522spanId%2522' +
        '%253A%2522abcdef%2522%257D%257D%257D'
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
