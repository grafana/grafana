import { getRecentGeneralActions } from './recentActions';

jest.mock('app/core/services/recentActionsSrv', () => ({
  getRecentActions: jest.fn(),
}));

describe('recentActions', () => {
  let getRecentActionsSpy: jest.SpyInstance;

  const mockRecentItems = [
    {
      id: 'dashboard-1',
      title: 'Viewed Dashboard 1',
      url: '/d/dashboard-1',
    },
    {
      id: 'explore-1',
      title: 'Explored Data',
      url: '/explore',
    },
    {
      id: 'dashboard-2',
      title: 'Viewed Dashboard 2',
      url: '/d/dashboard-2',
    },
    {
      id: 'alert-1',
      title: 'Checked Alert',
      url: '/alerting/1',
    },
    {
      id: 'settings-1',
      title: 'Opened Settings',
      url: '/settings',
    },
  ];

  beforeAll(() => {
    getRecentActionsSpy = jest.spyOn(require('app/core/services/recentActionsSrv'), 'getRecentActions');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecentGeneralActions', () => {
    it('returns an array of CommandPaletteActions based on recent activity', async () => {
      getRecentActionsSpy.mockReturnValue(mockRecentItems);

      const results = await getRecentGeneralActions();

      expect(getRecentActionsSpy).toHaveBeenCalled();
      expect(results).toEqual([
        {
          id: 'recent-action-dashboard-1',
          name: 'Viewed Dashboard 1',
          section: 'Recent actions',
          url: '/d/dashboard-1',
          priority: 7,
        },
        {
          id: 'recent-action-explore-1',
          name: 'Explored Data',
          section: 'Recent actions',
          url: '/explore',
          priority: 7,
        },
        {
          id: 'recent-action-dashboard-2',
          name: 'Viewed Dashboard 2',
          section: 'Recent actions',
          url: '/d/dashboard-2',
          priority: 7,
        },
        {
          id: 'recent-action-alert-1',
          name: 'Checked Alert',
          section: 'Recent actions',
          url: '/alerting/1',
          priority: 7,
        },
        {
          id: 'recent-action-settings-1',
          name: 'Opened Settings',
          section: 'Recent actions',
          url: '/settings',
          priority: 7,
        },
      ]);
    });

    it('returns an empty array if no recent actions are found', async () => {
      getRecentActionsSpy.mockReturnValue([]);

      const results = await getRecentGeneralActions();

      expect(getRecentActionsSpy).toHaveBeenCalled();
      expect(results).toEqual([]);
    });
  });
});
