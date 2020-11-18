import { DashboardLink } from '../../state/DashboardModel';
import { DashboardSearchHit, DashboardSearchItemType } from '../../../search/types';
import { resolveLinks, searchForTags } from './DashboardLinksDashboard';
import { describe, expect } from '../../../../../test/lib/common';

describe('searchForTags', () => {
  const setupTestContext = () => {
    const tags = ['A', 'B'];
    const link: DashboardLink = {
      targetBlank: false,
      asDropdown: false,
      icon: 'some icon',
      tags,
      title: 'some title',
      tooltip: 'some tooltip',
      type: 'dashboards',
      url: '/d/6ieouugGk/DashLinks',
    };
    const backendSrv: any = {
      search: jest.fn(args => []),
    };

    return { link, backendSrv };
  };

  describe('when called', () => {
    it('then tags from link should be used in search and limit should be 100', async () => {
      const { link, backendSrv } = setupTestContext();

      const results = await searchForTags(link.tags, { getBackendSrv: () => backendSrv });

      expect(results.length).toEqual(0);
      expect(backendSrv.search).toHaveBeenCalledWith({ tag: ['A', 'B'], limit: 100 });
      expect(backendSrv.search).toHaveBeenCalledTimes(1);
    });
  });
});

describe('resolveLinks', () => {
  const setupTestContext = (dashboardId: number, searchHitId: number) => {
    const link: DashboardLink = {
      targetBlank: false,
      asDropdown: false,
      icon: 'some icon',
      tags: [],
      title: 'some title',
      tooltip: 'some tooltip',
      type: 'dashboards',
      url: '/d/6ieouugGk/DashLinks',
    };
    const searchHits: DashboardSearchHit[] = [
      {
        id: searchHitId,
        title: 'DashLinks',
        url: '/d/6ieouugGk/DashLinks',
        isStarred: false,
        items: [],
        tags: [],
        uri: 'db/DashLinks',
        type: DashboardSearchItemType.DashDB,
      },
    ];
    const linkSrv: any = {
      getLinkUrl: jest.fn(args => args.url),
    };
    const sanitize = jest.fn(args => args);
    const sanitizeUrl = jest.fn(args => args);

    return { dashboardId, link, searchHits, linkSrv, sanitize, sanitizeUrl };
  };

  describe('when called', () => {
    it('should filter out the calling dashboardId', () => {
      const { dashboardId, link, searchHits, linkSrv, sanitize, sanitizeUrl } = setupTestContext(1, 1);

      const results = resolveLinks(dashboardId, link, searchHits, { getLinkSrv: () => linkSrv, sanitize, sanitizeUrl });

      expect(results.length).toEqual(0);
      expect(linkSrv.getLinkUrl).toHaveBeenCalledTimes(0);
      expect(sanitize).toHaveBeenCalledTimes(0);
      expect(sanitizeUrl).toHaveBeenCalledTimes(0);
    });

    it('should resolve link url', () => {
      const { dashboardId, link, searchHits, linkSrv, sanitize, sanitizeUrl } = setupTestContext(1, 2);

      const results = resolveLinks(dashboardId, link, searchHits, { getLinkSrv: () => linkSrv, sanitize, sanitizeUrl });

      expect(results.length).toEqual(1);
      expect(linkSrv.getLinkUrl).toHaveBeenCalledTimes(1);
      expect(linkSrv.getLinkUrl).toHaveBeenCalledWith({ ...link, url: searchHits[0].url });
    });

    it('should sanitize title', () => {
      const { dashboardId, link, searchHits, linkSrv, sanitize, sanitizeUrl } = setupTestContext(1, 2);

      const results = resolveLinks(dashboardId, link, searchHits, { getLinkSrv: () => linkSrv, sanitize, sanitizeUrl });

      expect(results.length).toEqual(1);
      expect(sanitize).toHaveBeenCalledTimes(1);
      expect(sanitize).toHaveBeenCalledWith(searchHits[0].title);
    });

    it('should sanitize url', () => {
      const { dashboardId, link, searchHits, linkSrv, sanitize, sanitizeUrl } = setupTestContext(1, 2);

      const results = resolveLinks(dashboardId, link, searchHits, { getLinkSrv: () => linkSrv, sanitize, sanitizeUrl });

      expect(results.length).toEqual(1);
      expect(sanitizeUrl).toHaveBeenCalledTimes(1);
      expect(sanitizeUrl).toHaveBeenCalledWith(searchHits[0].url);
    });
  });
});
