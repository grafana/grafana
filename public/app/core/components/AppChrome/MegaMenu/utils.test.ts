import { NavModelItem } from '@grafana/data';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';

import { enrichHelpItem, getActiveItem } from './utils';

jest.mock('../../../app_events', () => ({
  publish: jest.fn(),
}));

describe('enrichConfigItems', () => {
  let mockHelpNode: NavModelItem;

  beforeEach(() => {
    mockHelpNode = {
      id: 'help',
      text: 'Help',
    };
  });

  it('enhances the help node with extra child links', () => {
    const contextSrv = new ContextSrv();
    setContextSrv(contextSrv);
    const helpNode = enrichHelpItem(mockHelpNode);
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

describe('getActiveItem', () => {
  const starredDashboardUid = 'foo';
  const mockNavTree: NavModelItem[] = [
    {
      text: 'Item',
      url: '/item',
      id: 'item',
    },
    {
      text: 'Item with children',
      url: '/itemWithChildren',
      id: 'item-with-children',
      children: [
        {
          text: 'Child',
          url: '/child',
          id: 'child',
        },
      ],
    },
    {
      text: 'Base',
      url: '/',
      id: 'home',
    },
    {
      text: 'Starred',
      url: '/dashboards?starred',
      id: 'starred',
      children: [
        {
          id: `starred/${starredDashboardUid}`,
          text: 'Lazy Loading',
          url: `/d/${starredDashboardUid}/some-name`,
        },
      ],
    },
    {
      text: 'Dashboards',
      url: '/dashboards',
      id: 'dashboards',
    },
  ];

  it('returns an exact match at the top level', () => {
    const mockPage: NavModelItem = {
      text: 'Some current page',
      id: 'item',
    };
    expect(getActiveItem(mockNavTree, mockPage)?.id).toEqual('item');
  });

  it('returns parent item if no other matches in nav tree', () => {
    const mockPage: NavModelItem = {
      text: 'Some child page',
      id: 'something-that-doesnt-exist',
      parentItem: {
        text: 'Some home page',
        id: 'home',
      },
    };
    expect(getActiveItem(mockNavTree, mockPage)?.id).toEqual('home');
  });

  it('returns an exact child match', () => {
    const mockPage: NavModelItem = {
      text: 'Some child page',
      id: 'child',
    };
    expect(getActiveItem(mockNavTree, mockPage)?.id).toEqual('child');
  });

  it('returns the dashboards route link if the pathname starts with /d/ and is not a starred dashboard', () => {
    const mockPage: NavModelItem = {
      text: 'Dashboards',
      id: 'dashboards',
    };
    expect(getActiveItem(mockNavTree, mockPage, '/d/foo/some-name')?.id).toEqual('starred/foo');
  });

  it('handles home page', () => {
    const mockPage: NavModelItem = {
      text: 'Something else',
      id: 'not-home',
    };
    expect(getActiveItem(mockNavTree, mockPage, '/')?.id).toEqual('home');
  });
});
