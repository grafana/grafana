import { getFieldLinksForExplore } from './links';
import {
  ArrayVector,
  DataLink,
  DataSourceInstanceSettings,
  dateTime,
  Field,
  FieldType,
  LinkModel,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import { setLinkSrv } from '../../panel/panellinks/link_srv';
import { setDataSourceSrv } from '@grafana/runtime';

describe('getFieldLinksForExplore', () => {
  it('returns correct link model for external link', () => {
    const { field, range } = setup({
      title: 'external',
      url: 'http://regionalhost',
    });
    const links = getFieldLinksForExplore(field, 0, jest.fn(), range);

    expect(links[0].href).toBe('http://regionalhost');
    expect(links[0].title).toBe('external');
  });

  it('returns generates title for external link', () => {
    const { field, range } = setup({
      title: '',
      url: 'http://regionalhost',
    });
    const links = getFieldLinksForExplore(field, 0, jest.fn(), range);

    expect(links[0].href).toBe('http://regionalhost');
    expect(links[0].title).toBe('regionalhost');
  });

  it('returns correct link model for internal link', () => {
    const { field, range } = setup({
      title: '',
      url: 'query_1',
      meta: {
        datasourceUid: 'uid_1',
      },
    });
    const splitfn = jest.fn();
    const links = getFieldLinksForExplore(field, 0, splitfn, range);

    expect(links[0].href).toBe(
      '/explore?left={"range":{"from":"now-1h","to":"now"},"datasource":"test_ds","queries":[{"query":"query_1"}],"mode":"Metrics","ui":{"showingGraph":true,"showingTable":true,"showingLogs":true}}'
    );
    expect(links[0].title).toBe('test_ds');

    if (links[0].onClick) {
      links[0].onClick({});
    }

    expect(splitfn).toBeCalledWith({ datasourceUid: 'uid_1', query: 'query_1' });
  });
});

function setup(link: DataLink) {
  setLinkSrv({
    getDataLinkUIModel(link: DataLink, scopedVars: ScopedVars, origin: any): LinkModel<any> {
      return {
        href: link.url,
        title: link.title,
        target: '_blank',
        origin: origin,
      };
    },
    getAnchorInfo(link: DataLink) {
      return { ...link };
    },
    getLinkUrl(link: DataLink) {
      return link.url;
    },
  });
  setDataSourceSrv({
    getDataSourceSettingsByUid(uid: string) {
      return {
        id: 1,
        uid: 'uid_1',
        type: 'metrics',
        name: 'test_ds',
        meta: {},
        jsonData: {},
      } as DataSourceInstanceSettings;
    },
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
    from: dateTime(),
    to: dateTime(),
    raw: {
      from: 'now-1h',
      to: 'now',
    },
  };

  return { range, field };
}
