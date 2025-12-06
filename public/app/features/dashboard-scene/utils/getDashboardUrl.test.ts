import { getDashboardUrl } from './getDashboardUrl';

describe('dashboard utils', () => {
  it('Can getUrl', () => {
    const url = getDashboardUrl({ uid: 'dash-1', currentQueryParams: '?orgId=1&filter=A' });

    expect(url).toBe('/d/dash-1?orgId=1&filter=A');
  });

  it('Can getUrl with subpath', () => {
    const url = getDashboardUrl({
      uid: 'dash-1',
      subPath: '/panel-edit/2',
      currentQueryParams: '?orgId=1&filter=A',
    });

    expect(url).toBe('/d/dash-1/panel-edit/2?orgId=1&filter=A');
  });

  it('Can getUrl for a snapshot', () => {
    const url = getDashboardUrl({
      uid: 'dash-1',
      isSnapshot: true,
      currentQueryParams: '?orgId=1&filter=A',
    });

    expect(url).toBe('/dashboard/snapshot/dash-1?orgId=1&filter=A');
  });

  it('Can getUrl with slug', () => {
    const url = getDashboardUrl({
      uid: 'dash-1',
      slug: 'dash-1-slug',
      subPath: '/panel-edit/2',
      currentQueryParams: '?orgId=1&filter=A',
    });

    expect(url).toBe('/d/dash-1/dash-1-slug/panel-edit/2?orgId=1&filter=A');
  });

  it('Can getURL without shareView param', async () => {
    const url = getDashboardUrl({
      uid: 'dash-1',
      currentQueryParams: '?orgId=1&filter=A&shareView=link',
    });

    expect(url).toBe('/d/dash-1?orgId=1&filter=A');
  });

  it('Can getUrl with params removed and added', () => {
    const url = getDashboardUrl({
      uid: 'dash-1',
      currentQueryParams: '?orgId=1&filter=A',
      updateQuery: { filter: null, new: 'A' },
    });

    expect(url).toBe('/d/dash-1?orgId=1&new=A');
  });

  it('Empty uid should be treated as a new dashboard', () => {
    const url = getDashboardUrl({
      uid: '',
      currentQueryParams: '?orgId=1&filter=A',
    });

    expect(url).toBe('/dashboard/new?orgId=1&filter=A');
  });

  it('should remove time params (from/to) when set to null in updateQuery', () => {
    const url = getDashboardUrl({
      uid: 'dash-1',
      currentQueryParams: '?orgId=1&from=2024-01-01T00:00:00Z&to=2024-01-01T06:00:00Z&theme=dark',
      updateQuery: { from: null, to: null },
    });

    expect(url).toBe('/d/dash-1?orgId=1&theme=dark');
    expect(url).not.toContain('from=');
    expect(url).not.toContain('to=');
  });

  it('should remove time params even when other params are present', () => {
    const url = getDashboardUrl({
      uid: 'dash-1',
      currentQueryParams: '?orgId=1&from=now-6h&to=now&var-datasource=prometheus',
      updateQuery: { from: null, to: null },
    });

    expect(url).toBe('/d/dash-1?orgId=1&var-datasource=prometheus');
    expect(url).not.toContain('from=');
    expect(url).not.toContain('to=');
  });
});
