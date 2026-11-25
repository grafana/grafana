import { getPageHistoryService, setPageHistoryService } from './PageHistoryService';

describe('PageHistoryService', () => {
  it('throws until Grafana has set it', () => {
    expect(() => getPageHistoryService()).toThrow('PageHistoryService is not set');
  });

  it('returns the service that was set', async () => {
    const items = [{ kind: 'dashboard' as const, uid: 'abc', pathname: '/d/abc', lastVisited: 1 }];
    setPageHistoryService({ getEntries: () => Promise.resolve(items) });

    await expect(getPageHistoryService().getEntries()).resolves.toEqual(items);
  });
});
