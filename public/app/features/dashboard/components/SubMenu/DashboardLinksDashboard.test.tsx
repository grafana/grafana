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

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

const dashboardUID = '1';

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

const getDashboardLink = () => screen.findByRole('link', { name: new RegExp(dashbdD.item.title) });

const renderComponent = (props: DeepPartial<ComponentProps<typeof DashboardLinksDashboard>> = {}) => {
  return render(
    <DashboardLinksDashboard
      link={{ ...baseLinkProps, ...props.link, tags: (props.link?.tags || []) as string[] }}
      dashboardUID={props.dashboardUID || dashboardUID}
      linkInfo={{ title: 'some title', ...props.linkInfo }}
    />
  );
};

describe.each([
  // App platform APIs
  true,
  // Legacy APIs
  false,
])('with unifiedStorageSearchUI: %s', (featureTogglesEnabled) => {
  testWithFeatureToggles(featureTogglesEnabled ? ['unifiedStorageSearchUI'] : []);

  describe('DashboardLinksDashboard', () => {
    it('renders a dropdown', async () => {
      const { user } = renderComponent();
      const button = screen.getByRole('button', { name: /some title/i });
      await user.click(button);
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      expect(await getDashboardLink()).toBeInTheDocument();
    });

    it('renders dropdown items with target _blank', async () => {
      const { user } = renderComponent({ link: { targetBlank: true } });
      const button = screen.getByRole('button', { name: /some title/i });
      await user.click(button);
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      expect(await getDashboardLink()).toHaveAttribute('target', '_blank');
    });

    it('handles an empty list of links', async () => {
      const { user } = renderComponent({ link: { tags: ['foo-some-tag-of-which-there-are-none'] } });
      const button = screen.getByRole('button', { name: /some title/i });
      await user.click(button);

      expect(screen.getByRole('menuitem', { name: /no dashboards found/i })).toBeInTheDocument();
    });

    it('renders a list of links', async () => {
      renderComponent({ link: { asDropdown: false } });

      const dashboardLink = await getDashboardLink();
      expect(dashboardLink).toBeInTheDocument();
      expect(dashboardLink).not.toHaveAttribute('target', '_blank');
    });

    it('renders a list of links with target _blank', async () => {
      renderComponent({ link: { asDropdown: false, targetBlank: true } });

      const dashboardLink = await getDashboardLink();
      expect(dashboardLink).toHaveAttribute('target', '_blank');
    });

    it('does not render a link to its own dashboard', async () => {
      renderComponent({ link: { asDropdown: false }, dashboardUID: dashbdD.item.uid });

      await screen.findAllByRole('link');
      expect(screen.queryByRole('link', { name: new RegExp(dashbdD.item.title) })).not.toBeInTheDocument();
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
      const searchHitsArray = [...searchHits];

      const results = resolveLinks(dashbdD.item.uid, link, searchHitsArray, {
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
      const searchHitsArray = [...searchHits];

      const results = resolveLinks(dashboardUID, link, searchHitsArray, {
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
      const searchHitsArray = [...searchHits];

      const results = resolveLinks(dashboardUID, link, searchHitsArray, {
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
      const searchHitsArray = [...searchHits];

      const results = resolveLinks(dashboardUID, link, searchHitsArray, {
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
