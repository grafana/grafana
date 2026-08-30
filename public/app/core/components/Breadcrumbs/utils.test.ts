import { type GrafanaConfig, locationUtil, type NavModelItem } from '@grafana/data';

import { buildBreadcrumbs } from './utils';

const mockHomeNav: NavModelItem = {
  text: 'Home',
  url: '/home',
  id: 'home',
};

describe('breadcrumb utils', () => {
  describe('buildBreadcrumbs', () => {
    it('includes breadcrumbs for the section nav', () => {
      const sectionNav: NavModelItem = {
        text: 'My section',
        url: '/my-section',
      };
      expect(buildBreadcrumbs(sectionNav)).toEqual([{ text: 'My section', href: '/my-section' }]);
    });

    it('includes breadcrumbs for the page nav', () => {
      const sectionNav: NavModelItem = {
        text: 'My section',
        url: '/my-section',
      };

      const pageNav: NavModelItem = {
        text: 'My page',
        url: '/my-page',
      };
      expect(buildBreadcrumbs(sectionNav, pageNav)).toEqual([
        { text: 'My section', href: '/my-section' },
        { text: 'My page', href: '/my-page' },
      ]);
    });

    it('includes breadcrumbs for any parents in the section nav', () => {
      const sectionNav: NavModelItem = {
        text: 'My section',
        url: '/my-section',
        parentItem: {
          text: 'My parent section',
          url: '/my-parent-section',
        },
      };
      expect(buildBreadcrumbs(sectionNav)).toEqual([
        { text: 'My parent section', href: '/my-parent-section' },
        { text: 'My section', href: '/my-section' },
      ]);
    });

    it('includes breadcrumbs for any parents in the section nav or page nav', () => {
      const pageNav: NavModelItem = {
        text: 'My page',
        url: '/my-page',
        parentItem: {
          text: 'My parent page',
          url: '/my-parent-page',
        },
      };
      const sectionNav: NavModelItem = {
        text: 'My section',
        url: '/my-section',
        parentItem: {
          text: 'My parent section',
          url: '/my-parent-section',
        },
      };
      expect(buildBreadcrumbs(sectionNav, pageNav)).toEqual([
        { text: 'My parent section', href: '/my-parent-section' },
        { text: 'My section', href: '/my-section' },
        { text: 'My parent page', href: '/my-parent-page' },
        { text: 'My page', href: '/my-page' },
      ]);
    });

    it('shortcircuits if the home nav is found early', () => {
      const pageNav: NavModelItem = {
        text: 'My page',
        url: '/my-page',
        parentItem: {
          text: 'My parent page',
          url: '/home',
        },
      };
      const sectionNav: NavModelItem = {
        text: 'My section',
        url: '/my-section',
        parentItem: {
          text: 'My parent section',
          url: '/my-parent-section',
        },
      };
      expect(buildBreadcrumbs(sectionNav, pageNav, mockHomeNav)).toEqual([{ text: 'My page', href: '/my-page' }]);
    });

    it('matches the home nav ignoring query parameters', () => {
      const pageNav: NavModelItem = {
        text: 'My page',
        url: '/my-page',
        parentItem: {
          text: 'My parent page',
          url: '/home?orgId=1',
        },
      };
      const sectionNav: NavModelItem = {
        text: 'My section',
        url: '/my-section',
        parentItem: {
          text: 'My parent section',
          url: '/my-parent-section',
        },
      };
      expect(buildBreadcrumbs(sectionNav, pageNav, mockHomeNav)).toEqual([{ text: 'My page', href: '/my-page' }]);
    });

    it('does ignore duplicates', () => {
      const pageNav: NavModelItem = {
        text: 'My page',
        url: '/my-page',
        parentItem: {
          text: 'My section',
          // same url as section nav, but this one should win/overwrite it
          url: '/my-section?from=1h&to=now',
        },
      };

      const sectionNav: NavModelItem = {
        text: 'My section',
        url: '/my-section',
      };

      expect(buildBreadcrumbs(sectionNav, pageNav, mockHomeNav)).toEqual([
        { text: 'My section', href: '/my-section?from=1h&to=now' },
        { text: 'My page', href: '/my-page' },
      ]);
    });

    describe('with appSubUrl', () => {
      beforeAll(() => {
        locationUtil.initialize({
          config: { appSubUrl: '/grafana' } as GrafanaConfig,
          getVariablesUrlParams: jest.fn(),
          getTimeRangeForUrl: jest.fn(),
        });
      });

      afterAll(() => {
        locationUtil.initialize({
          config: { appSubUrl: '' } as GrafanaConfig,
          getVariablesUrlParams: jest.fn(),
          getTimeRangeForUrl: jest.fn(),
        });
      });

      it('prefixes a bare nav url with the subpath exactly once', () => {
        const sectionNav: NavModelItem = {
          text: 'My section',
          url: '/my-section',
        };
        expect(buildBreadcrumbs(sectionNav)).toEqual([{ text: 'My section', href: '/grafana/my-section' }]);
      });

      it('does not double-prefix a nav url that already carries the subpath', () => {
        const sectionNav: NavModelItem = {
          text: 'My section',
          url: '/grafana/my-section',
        };
        expect(buildBreadcrumbs(sectionNav)).toEqual([{ text: 'My section', href: '/grafana/my-section' }]);
      });

      it('still matches the home nav and dedupes using the unprefixed nav urls', () => {
        const pageNav: NavModelItem = {
          text: 'My page',
          url: '/my-page',
          parentItem: {
            text: 'My parent page',
            url: '/home',
          },
        };
        const sectionNav: NavModelItem = {
          text: 'My section',
          url: '/my-section',
          parentItem: {
            text: 'My parent section',
            url: '/my-parent-section',
          },
        };
        expect(buildBreadcrumbs(sectionNav, pageNav, mockHomeNav)).toEqual([
          { text: 'My page', href: '/grafana/my-page' },
        ]);
      });
    });
  });
});
