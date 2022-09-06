import { NavModelItem } from '@grafana/data';

import { buildBreadcrumbs } from './utils';

describe('breadcrumb utils', () => {
  describe('buildBreadcrumbs', () => {
    it('includes the home breadcrumb at the root', () => {
      const sectionNav: NavModelItem = {
        text: 'My section',
        url: '/my-section',
      };
      const result = buildBreadcrumbs(sectionNav);
      expect(result[0]).toEqual({ icon: 'home-alt', href: '/', text: 'Home' });
    });

    it('includes breadcrumbs for the section nav', () => {
      const sectionNav: NavModelItem = {
        text: 'My section',
        url: '/my-section',
      };
      expect(buildBreadcrumbs(sectionNav)).toEqual([
        { icon: 'home-alt', href: '/', text: 'Home' },
        { text: 'My section', href: '/my-section' },
      ]);
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
        { icon: 'home-alt', href: '/', text: 'Home' },
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
        { icon: 'home-alt', href: '/', text: 'Home' },
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
        { icon: 'home-alt', href: '/', text: 'Home' },
        { text: 'My parent section', href: '/my-parent-section' },
        { text: 'My section', href: '/my-section' },
        { text: 'My parent page', href: '/my-parent-page' },
        { text: 'My page', href: '/my-page' },
      ]);
    });
  });
});
