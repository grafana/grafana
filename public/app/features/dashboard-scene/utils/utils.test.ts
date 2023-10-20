import { getDashboardUrl } from './utils';

describe('dashboard utils', () => {
  it('Can getUrl', () => {
    const url = getDashboardUrl({ uid: 'dash-1', currentQueryParams: '?orgId=1&filter=A' });

    expect(url).toBe('/scenes/dashboard/dash-1?orgId=1&filter=A');
  });

  it('Can getUrl with subpath', () => {
    const url = getDashboardUrl({ uid: 'dash-1', subPath: '/panel-edit/2', currentQueryParams: '?orgId=1&filter=A' });

    expect(url).toBe('/scenes/dashboard/dash-1/panel-edit/2?orgId=1&filter=A');
  });

  it('Can getUrl with params removed and addded', () => {
    const url = getDashboardUrl({
      uid: 'dash-1',
      currentQueryParams: '?orgId=1&filter=A',
      updateQuery: { filter: null, new: 'A' },
    });

    expect(url).toBe('/scenes/dashboard/dash-1?orgId=1&new=A');
  });
});
