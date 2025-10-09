import { ComponentProps } from 'react';
import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { DashboardLink } from '@grafana/schema';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { testWithFeatureToggles } from 'app/features/alerting/unified/test/test-utils';
import { LinkSrv } from 'app/features/panel/panellinks/link_srv';
import { resetGrafanaSearcher } from 'app/features/search/service/searcher';

import { resolveLinks, searchForTags, DashboardLinksDashboard } from './DashboardLinksDashboard';

const [_, { dashbdD }] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();

afterEach(() => {
  resetGrafanaSearcher();
});

const dashboardUID = '1';

describe.each([
  // App platform APIs
  true,
  // Legacy APIs
  false,
])('with unifiedStorageSearchUI: %s', (featureTogglesEnabled) => {
  testWithFeatureToggles(featureTogglesEnabled ? ['unifiedStorageSearchUI'] : []);

  describe('DashboardLinksDashboard', () => {
    const baseLinkProps: ComponentProps<typeof DashboardLinksDashboard>['link'] = {
      asDropdown: true,
      icon: 'some icon',
      includeVars: false,
      keepTime: false,
      tags: [],
      targetBlank: false,
      title: 'some title',
      tooltip: '',
      type: 'dashboards',
    };

    it('renders a dropdown', async () => {
      const { user } = render(
        <DashboardLinksDashboard
          link={{ ...baseLinkProps }}
          dashboardUID={dashboardUID}
          linkInfo={{ title: 'some title' }}
        />
      );
      const button = screen.getByRole('button', { name: /some title/i });
      await user.click(button);
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      expect(await screen.findByRole('link', { name: new RegExp(dashbdD.item.title) })).toBeInTheDocument();
    });

    it('handles an empty list of links', async () => {
      const { user } = render(
        <DashboardLinksDashboard
          link={{ ...baseLinkProps, tags: ['foo-some-tag-of-which-there-are-none'] }}
          dashboardUID={dashboardUID}
          linkInfo={{ title: 'some title' }}
        />
      );
      const button = screen.getByRole('button', { name: /some title/i });
      await user.click(button);

      expect(screen.getByRole('menuitem', { name: /no dashboards found/i })).toBeInTheDocument();
    });

    it('renders a list of links', async () => {
      render(
        <DashboardLinksDashboard
          link={{ ...baseLinkProps, asDropdown: false }}
          dashboardUID={dashboardUID}
          linkInfo={{ title: 'some title' }}
        />
      );

      expect(await screen.findByRole('link', { name: new RegExp(dashbdD.item.title) })).toBeInTheDocument();
    });
  });

  describe('resolveLinks', () => {
    const setupTestContext = () => {
      const link: DashboardLink = {
        targetBlank: false,
        keepTime: false,
        includeVars: false,
        asDropdown: false,
        icon: 'some icon',
        tags: [],
        title: 'some title',
        tooltip: 'some tooltip',
        type: 'dashboards',
        url: '/d/6ieouugGk/DashLinks',
      };
      const linkSrv = {
        getLinkUrl: jest.fn((args) => args.url),
      } as unknown as LinkSrv;
      const sanitize = jest.fn((args) => args);
      const sanitizeUrl = jest.fn((args) => args);

      return { link, linkSrv, sanitize, sanitizeUrl };
    };

    it('should filter out the calling dashboardUID', async () => {
      const { link, linkSrv, sanitize, sanitizeUrl } = setupTestContext();
      const { view: searchHits, totalRows } = await searchForTags([]);

      const results = resolveLinks(dashbdD.item.uid, link, searchHits, {
        getLinkSrv: () => linkSrv,
        sanitize,
        sanitizeUrl,
      });

      expect(results.find((result) => result.uid === dashbdD.item.uid)).toBeUndefined();

      const expectedNumberOfResults = totalRows - 1;
      expect(results.length).toEqual(expectedNumberOfResults);
      expect(linkSrv.getLinkUrl).toHaveBeenCalledTimes(expectedNumberOfResults);
      expect(sanitize).toHaveBeenCalledTimes(expectedNumberOfResults);
      expect(sanitizeUrl).toHaveBeenCalledTimes(expectedNumberOfResults);
    });

    it('should resolve link url', async () => {
      const { link, linkSrv, sanitize, sanitizeUrl } = setupTestContext();
      const { view: searchHits, totalRows } = await searchForTags([]);

      const results = resolveLinks(dashboardUID, link, searchHits, {
        getLinkSrv: () => linkSrv,
        sanitize,
        sanitizeUrl,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(linkSrv.getLinkUrl).toHaveBeenCalledTimes(totalRows);
      expect(linkSrv.getLinkUrl).toHaveBeenCalledWith({ ...link, url: searchHits.at(0)?.url });
    });

    it('should sanitize title', async () => {
      const { link, linkSrv, sanitize, sanitizeUrl } = setupTestContext();
      const { view: searchHits, totalRows } = await searchForTags([]);

      const results = resolveLinks(dashboardUID, link, searchHits, {
        getLinkSrv: () => linkSrv,
        sanitize,
        sanitizeUrl,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(sanitize).toHaveBeenCalledTimes(totalRows);
      expect(sanitize).toHaveBeenCalledWith(searchHits.at(0)?.name);
    });

    it('should sanitize url', async () => {
      const { link, linkSrv, sanitize, sanitizeUrl } = setupTestContext();
      const result = await searchForTags([]);
      const { view: searchHits, totalRows } = result;
      const results = resolveLinks(dashboardUID, link, searchHits, {
        getLinkSrv: () => linkSrv,
        sanitize,
        sanitizeUrl,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(sanitizeUrl).toHaveBeenCalledTimes(totalRows);
      expect(sanitizeUrl).toHaveBeenCalledWith(searchHits.at(0)?.url);
    });
  });
});
