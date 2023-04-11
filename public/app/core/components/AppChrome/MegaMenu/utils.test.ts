import { Location } from 'history';

import { GrafanaConfig, locationUtil, NavModelItem } from '@grafana/data';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';

import { enrichConfigItems, getActiveItem, isMatchOrChildMatch } from './utils';

jest.mock('../../app_events', () => ({
  publish: jest.fn(),
}));

describe('enrichConfigItems', () => {
  let mockItems: NavModelItem[];
  const mockLocation: Location<unknown> = {
    hash: '',
    pathname: '/',
    search: '',
    state: '',
  };

  beforeEach(() => {
    mockItems = [
      {
        id: 'profile',
        text: 'Profile',
        hideFromMenu: true,
      },
      {
        id: 'help',
        text: 'Help',
        hideFromMenu: true,
      },
    ];
  });

  it('enhances the help node with extra child links', () => {
    const contextSrv = new ContextSrv();
    setContextSrv(contextSrv);
    const enrichedConfigItems = enrichConfigItems(mockItems, mockLocation);
    const helpNode = enrichedConfigItems.find((item) => item.id === 'help');
    expect(helpNode!.children).toContainEqual(
      expect.objectContaining({
        text: 'Documentation',
      })
    );
    expect(helpNode!.children).toContainEqual(
      expect.objectContaining({
        text: 'Support',
      })
    );
    expect(helpNode!.children).toContainEqual(
      expect.objectContaining({
        text: 'Community',
      })
    );
    expect(helpNode!.children).toContainEqual(
      expect.objectContaining({
        text: 'Keyboard shortcuts',
      })
    );
  });
});

describe('isMatchOrChildMatch', () => {
  const mockChild: NavModelItem = {
    text: 'Child',
    url: '/dashboards/child',
  };
  const mockItemToCheck: NavModelItem = {
    text: 'Dashboards',
    url: '/dashboards',
    children: [mockChild],
  };

  it('returns true if the itemToCheck is an exact match with the searchItem', () => {
    const searchItem = mockItemToCheck;
    expect(isMatchOrChildMatch(mockItemToCheck, searchItem)).toBe(true);
  });

  it('returns true if the itemToCheck has a child that matches the searchItem', () => {
    const searchItem = mockChild;
    expect(isMatchOrChildMatch(mockItemToCheck, searchItem)).toBe(true);
  });

  it('returns false otherwise', () => {
    const searchItem: NavModelItem = {
      text: 'No match',
      url: '/noMatch',
    };
    expect(isMatchOrChildMatch(mockItemToCheck, searchItem)).toBe(false);
  });
});

describe('getActiveItem', () => {
  const mockNavTree: NavModelItem[] = [
    {
      text: 'Item',
      url: '/item',
    },
    {
      text: 'Item with query param',
      url: '/itemWithQueryParam?foo=bar',
    },
    {
      text: 'Item after subpath',
      url: '/subUrl/itemAfterSubpath',
    },
    {
      text: 'Item with children',
      url: '/itemWithChildren',
      children: [
        {
          text: 'Child',
          url: '/child',
        },
      ],
    },
    {
      text: 'Alerting item',
      url: '/alerting/list',
    },
    {
      text: 'Base',
      url: '/',
    },
    {
      text: 'Starred',
      url: '/dashboards?starred',
      id: 'starred',
    },
    {
      text: 'Dashboards',
      url: '/dashboards',
    },
    {
      text: 'More specific dashboard',
      url: '/d/moreSpecificDashboard',
    },
  ];
  beforeEach(() => {
    locationUtil.initialize({
      config: { appSubUrl: '/subUrl' } as GrafanaConfig,
      getVariablesUrlParams: () => ({}),
      getTimeRangeForUrl: () => ({ from: 'now-7d', to: 'now' }),
    });
  });

  it('returns an exact match at the top level', () => {
    const mockPathName = '/item';
    expect(getActiveItem(mockNavTree, mockPathName)).toEqual({
      text: 'Item',
      url: '/item',
    });
  });

  it('returns an exact match ignoring root subpath', () => {
    const mockPathName = '/itemAfterSubpath';
    expect(getActiveItem(mockNavTree, mockPathName)).toEqual({
      text: 'Item after subpath',
      url: '/subUrl/itemAfterSubpath',
    });
  });

  it('returns an exact match ignoring query params', () => {
    const mockPathName = '/itemWithQueryParam?bar=baz';
    expect(getActiveItem(mockNavTree, mockPathName)).toEqual({
      text: 'Item with query param',
      url: '/itemWithQueryParam?foo=bar',
    });
  });

  it('returns an exact child match', () => {
    const mockPathName = '/child';
    expect(getActiveItem(mockNavTree, mockPathName)).toEqual({
      text: 'Child',
      url: '/child',
    });
  });

  it('returns the alerting link if the pathname is an alert notification', () => {
    const mockPathName = '/alerting/notification/foo';
    expect(getActiveItem(mockNavTree, mockPathName)).toEqual({
      text: 'Alerting item',
      url: '/alerting/list',
    });
  });

  it('returns the dashboards route link if the pathname starts with /d/', () => {
    const mockPathName = '/d/foo';
    expect(getActiveItem(mockNavTree, mockPathName)).toEqual({
      text: 'Dashboards',
      url: '/dashboards',
    });
  });

  it('returns a more specific link if one exists', () => {
    const mockPathName = '/d/moreSpecificDashboard';
    expect(getActiveItem(mockNavTree, mockPathName)).toEqual({
      text: 'More specific dashboard',
      url: '/d/moreSpecificDashboard',
    });
  });
});
