import { cloneDeep } from 'lodash';

import { NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';

import { getEnrichedHelpItem, getActiveItem, findByUrl } from './utils';

const starredDashboardUid = 'foo';
const mockNavTree: NavModelItem[] = [
  {
    text: 'Bookmarks',
    url: '/bookmarks',
    id: 'bookmarks',
    children: [
      {
        text: 'Item with children',
        url: '/itemWithChildren',
        id: 'item-with-children',
        parentItem: {
          text: 'Bookmarks',
          id: 'bookmarks',
        },
      },
    ],
  },
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

jest.mock('../../../app_events', () => ({
  publish: jest.fn(),
}));

describe('enrichConfigItems', () => {
  let mockHelpNode: NavModelItem = {
    id: 'help',
    text: 'Help',
  };
  let originalBuildInfo = { ...config.buildInfo };

  beforeAll(() => {
    config.buildInfo.versionString = '9.0.0-test';
  });

  afterAll(() => {
    config.buildInfo = originalBuildInfo;
  });

  it('enhances the help node with extra child links', () => {
    const contextSrv = new ContextSrv();
    setContextSrv(contextSrv);
    const helpNode = getEnrichedHelpItem(mockHelpNode);
    expect(helpNode.children).toContainEqual(
      expect.objectContaining({
        text: 'Documentation',
      })
    );
    expect(helpNode.children).toContainEqual(
      expect.objectContaining({
        text: 'Support',
      })
    );
    expect(helpNode.children).toContainEqual(
      expect.objectContaining({
        text: 'Community',
      })
    );
    expect(helpNode.children).toContainEqual(
      expect.objectContaining({
        text: 'Keyboard shortcuts',
      })
    );
  });

  it('adds the version string as subtitle', () => {
    const helpNode = getEnrichedHelpItem(mockHelpNode);
    expect(helpNode.subTitle).toBe(config.buildInfo.versionString);
  });

  it("doesn't mutate the original help node", () => {
    const originalHelpNode = cloneDeep(mockHelpNode);
    const newHelpNode = getEnrichedHelpItem(mockHelpNode);

    // The mockHelpNode should remain deeply equal to the clone we made of it
    expect(mockHelpNode).toEqual(originalHelpNode);

    // The new node should have a different identity than the original
    expect(newHelpNode).not.toBe(mockHelpNode);
    expect(newHelpNode.children).not.toBe(mockHelpNode.children);
  });
});

describe('getActiveItem', () => {
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
      parentItem: {
        text: 'Item with children',
        id: 'item-with-children',
      },
    };
    expect(getActiveItem(mockNavTree, mockPage)?.id).toEqual('child');
  });

  it('handles home page', () => {
    const mockPage: NavModelItem = {
      text: 'Something else',
      id: 'not-home',
    };
    expect(getActiveItem(mockNavTree, mockPage, '/')?.id).toEqual('home');
  });
});

describe('findByUrl', () => {
  it('returns the correct item at the top level', () => {
    expect(findByUrl(mockNavTree, '/item')).toEqual({
      text: 'Item',
      url: '/item',
      id: 'item',
    });
  });

  it('returns the correct child item', () => {
    expect(findByUrl(mockNavTree, '/child')).toEqual({
      text: 'Child',
      url: '/child',
      id: 'child',
    });
  });

  it('returns null if no item found', () => {
    expect(findByUrl(mockNavTree, '/no-item')).toBeNull();
  });
});
