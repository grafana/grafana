import { Location } from 'history';
import { NavModelItem } from '@grafana/data';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { getConfig, updateConfig } from '../../config';
import { enrichConfigItems, getForcedLoginUrl, isLinkActive, isSearchActive } from './utils';

jest.mock('../../app_events', () => ({
  publish: jest.fn(),
}));

describe('getForcedLoginUrl', () => {
  it.each`
    appSubUrl          | url                    | expected
    ${''}              | ${'/whatever?a=1&b=2'} | ${'/whatever?a=1&b=2&forceLogin=true'}
    ${'/grafana'}      | ${'/whatever?a=1&b=2'} | ${'/grafana/whatever?a=1&b=2&forceLogin=true'}
    ${'/grafana/test'} | ${'/whatever?a=1&b=2'} | ${'/grafana/test/whatever?a=1&b=2&forceLogin=true'}
    ${'/grafana'}      | ${''}                  | ${'/grafana?forceLogin=true'}
    ${'/grafana'}      | ${'/whatever'}         | ${'/grafana/whatever?forceLogin=true'}
    ${'/grafana'}      | ${'/whatever/'}        | ${'/grafana/whatever/?forceLogin=true'}
  `(
    "when appUrl set to '$appUrl' and appSubUrl set to '$appSubUrl' then result should be '$expected'",
    ({ appSubUrl, url, expected }) => {
      updateConfig({
        appSubUrl,
      });

      const result = getForcedLoginUrl(url);

      expect(result).toBe(expected);
    }
  );
});

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

  it('does not add a sign in item if a user signed in', () => {
    const contextSrv = new ContextSrv();
    contextSrv.user.isSignedIn = false;
    setContextSrv(contextSrv);
    const enrichedConfigItems = enrichConfigItems(mockItems, mockLocation, jest.fn());
    const signInNode = enrichedConfigItems.find((item) => item.id === 'signin');
    expect(signInNode).toBeDefined();
  });

  it('adds a sign in item if a user is not signed in', () => {
    const contextSrv = new ContextSrv();
    contextSrv.user.isSignedIn = true;
    setContextSrv(contextSrv);
    const enrichedConfigItems = enrichConfigItems(mockItems, mockLocation, jest.fn());
    const signInNode = enrichedConfigItems.find((item) => item.id === 'signin');
    expect(signInNode).toBeDefined();
  });

  it('does not add an org switcher to the profile node if there is 1 org', () => {
    const contextSrv = new ContextSrv();
    contextSrv.user.orgCount = 1;
    setContextSrv(contextSrv);
    const enrichedConfigItems = enrichConfigItems(mockItems, mockLocation, jest.fn());
    const profileNode = enrichedConfigItems.find((item) => item.id === 'profile');
    expect(profileNode!.children).toBeUndefined();
  });

  it('adds an org switcher to the profile node if there is more than 1 org', () => {
    const contextSrv = new ContextSrv();
    contextSrv.user.orgCount = 2;
    setContextSrv(contextSrv);
    const enrichedConfigItems = enrichConfigItems(mockItems, mockLocation, jest.fn());
    const profileNode = enrichedConfigItems.find((item) => item.id === 'profile');
    expect(profileNode!.children).toContainEqual(
      expect.objectContaining({
        text: 'Switch organization',
      })
    );
  });

  it('enhances the help node with extra child links', () => {
    const contextSrv = new ContextSrv();
    setContextSrv(contextSrv);
    const enrichedConfigItems = enrichConfigItems(mockItems, mockLocation, jest.fn());
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

describe('isLinkActive', () => {
  it('returns true if the link url matches the pathname', () => {
    const mockPathName = '/test';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/test',
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(true);
  });

  it('returns true if the pathname starts with the link url', () => {
    const mockPathName = '/test/edit';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/test',
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(true);
  });

  it('returns true if a child link url matches the pathname', () => {
    const mockPathName = '/testChild2';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/test',
      children: [
        {
          text: 'TestChild',
          url: '/testChild',
        },
        {
          text: 'TestChild2',
          url: '/testChild2',
        },
      ],
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(true);
  });

  it('returns true if the pathname starts with a child link url', () => {
    const mockPathName = '/testChild2/edit';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/test',
      children: [
        {
          text: 'TestChild',
          url: '/testChild',
        },
        {
          text: 'TestChild2',
          url: '/testChild2',
        },
      ],
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(true);
  });

  it('returns true for the alerting link if the pathname is an alert notification', () => {
    const mockPathName = '/alerting/notification/foo';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/alerting/list',
      children: [
        {
          text: 'TestChild',
          url: '/testChild',
        },
        {
          text: 'TestChild2',
          url: '/testChild2',
        },
      ],
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(true);
  });

  it('returns false if none of the link urls match the pathname', () => {
    const mockPathName = '/somethingWeird';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/test',
      children: [
        {
          text: 'TestChild',
          url: '/testChild',
        },
        {
          text: 'TestChild2',
          url: '/testChild2',
        },
      ],
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(false);
  });

  it('returns false for the base route if the pathname is not an exact match', () => {
    const mockPathName = '/foo';
    const mockLink: NavModelItem = {
      text: 'Test',
      url: '/',
      children: [
        {
          text: 'TestChild',
          url: '/',
        },
        {
          text: 'TestChild2',
          url: '/testChild2',
        },
      ],
    };
    expect(isLinkActive(mockPathName, mockLink)).toBe(false);
  });

  describe('when the newNavigation feature toggle is disabled', () => {
    beforeEach(() => {
      updateConfig({
        featureToggles: {
          ...getConfig().featureToggles,
          newNavigation: false,
        },
      });
    });

    it('returns true for the base route link if the pathname starts with /d/', () => {
      const mockPathName = '/d/foo';
      const mockLink: NavModelItem = {
        text: 'Test',
        url: '/',
        children: [
          {
            text: 'TestChild',
            url: '/testChild',
          },
          {
            text: 'TestChild2',
            url: '/testChild2',
          },
        ],
      };
      expect(isLinkActive(mockPathName, mockLink)).toBe(true);
    });

    it('returns false for the dashboards route if the pathname starts with /d/', () => {
      const mockPathName = '/d/foo';
      const mockLink: NavModelItem = {
        text: 'Test',
        url: '/dashboards',
        children: [
          {
            text: 'TestChild',
            url: '/testChild1',
          },
          {
            text: 'TestChild2',
            url: '/testChild2',
          },
        ],
      };
      expect(isLinkActive(mockPathName, mockLink)).toBe(false);
    });
  });

  describe('when the newNavigation feature toggle is enabled', () => {
    beforeEach(() => {
      updateConfig({
        featureToggles: {
          ...getConfig().featureToggles,
          newNavigation: true,
        },
      });
    });

    it('returns false for the base route if the pathname starts with /d/', () => {
      const mockPathName = '/d/foo';
      const mockLink: NavModelItem = {
        text: 'Test',
        url: '/',
        children: [
          {
            text: 'TestChild',
            url: '/',
          },
          {
            text: 'TestChild2',
            url: '/testChild2',
          },
        ],
      };
      expect(isLinkActive(mockPathName, mockLink)).toBe(false);
    });

    it('returns true for the dashboards route if the pathname starts with /d/', () => {
      const mockPathName = '/d/foo';
      const mockLink: NavModelItem = {
        text: 'Test',
        url: '/dashboards',
        children: [
          {
            text: 'TestChild',
            url: '/testChild1',
          },
          {
            text: 'TestChild2',
            url: '/testChild2',
          },
        ],
      };
      expect(isLinkActive(mockPathName, mockLink)).toBe(true);
    });
  });
});

describe('isSearchActive', () => {
  it('returns true if the search query parameter is "open"', () => {
    const mockLocation = {
      hash: '',
      pathname: '/',
      search: '?search=open',
      state: '',
    };
    expect(isSearchActive(mockLocation)).toBe(true);
  });

  it('returns false if the search query parameter is missing', () => {
    const mockLocation = {
      hash: '',
      pathname: '/',
      search: '',
      state: '',
    };
    expect(isSearchActive(mockLocation)).toBe(false);
  });
});
