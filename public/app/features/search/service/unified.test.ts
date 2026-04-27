import { config, setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { type SearchQuery } from './types';
import { toDashboardResults, type SearchHit, type SearchAPIResponse, UnifiedSearcher } from './unified';

beforeEach(() => {
  jest.clearAllMocks();
});

setBackendSrv(backendSrv);
setupMockServer();

describe('Unified Storage Searcher', () => {
  it('should perform search with basic query', async () => {
    const query: SearchQuery = {
      query: '*',
      limit: 50,
    };

    server.use(
      getCustomSearchHandler([
        { name: 'folder1', title: 'Folder 1', resource: 'folders' },
        { name: 'dashboard1', title: 'Dashboard 1', resource: 'dashboards', folder: 'folder1' },
      ])
    );

    const searcher = new UnifiedSearcher();

    const response = await searcher.search(query);

    expect(response.view.length).toBe(2);
    expect(response.view.get(0).title).toBe('Folder 1');
    expect(response.view.get(1).title).toBe('Dashboard 1');

    const df = response.view.dataFrame;
    const locationInfo = df.meta?.custom?.locationInfo;
    expect(locationInfo).toBeDefined();
    expect(locationInfo?.folder1.name).toBe('Folder 1');
  });

  it('should perform search and sync folders with missing folder', async () => {
    server.use(
      getCustomSearchHandler([
        { name: 'folder2', title: 'Folder 2', resource: 'folders' },
        { name: 'db1', title: 'DB 1', resource: 'dashboards', folder: 'folder1' },
        { name: 'db2', title: 'DB 2', resource: 'dashboards', folder: 'folder2' },
      ])
    );

    const query: SearchQuery = {
      query: '*',
      limit: 50,
    };

    const searcher = new UnifiedSearcher();

    const response = await searcher.search(query);

    expect(response.view.length).toBe(3);
    expect(response.view.get(0).title).toBe('Folder 2');
    expect(response.view.get(1).title).toBe('DB 1');
    expect(response.view.get(1).folder).toBe('sharedwithme');
    expect(response.view.get(2).title).toBe('DB 2');

    const df = response.view.dataFrame;
    const locationInfo = df.meta?.custom?.locationInfo;
    expect(locationInfo).toBeDefined();
    expect(locationInfo?.folder2.name).toBe('Folder 2');
  });

  it('should perform paging even with inconsistent fields', async () => {
    const query: SearchQuery = {
      query: '*',
      limit: 1,
    };

    server.use(
      getCustomSearchHandler([
        { name: 'dashboard1', title: 'Dashboard 1', resource: 'dashboards' },
        { name: 'dashboard2', title: 'Dashboard 2', resource: 'dashboards', description: 'foobar' },
      ])
    );

    const searcher = new UnifiedSearcher();
    const response = await searcher.search(query);

    expect(response.view.length).toBe(1);

    await response.loadMoreItems(1);

    expect(response.view.length).toBe(2);
    // TODO: right now this does not work (see unified.ts#getNextPage() for details) once the frame appending is fixed
    //  properly these expects should work
    // expect(response.view.get(0).description).toBe(null);
    // expect(response.view.get(1).description).toBe('foobar');
  });

  it('should filter search results by ownerReference', async () => {
    server.use(
      getCustomSearchHandler([
        {
          name: 'team-owned-dashboard',
          title: 'Team owned dashboard',
          resource: 'dashboards',
          ownerReferences: ['iam.grafana.app/Team/team-a'],
        },
        {
          name: 'other-team-dashboard',
          title: 'Other team dashboard',
          resource: 'dashboards',
          ownerReferences: ['iam.grafana.app/Team/team-b'],
        },
        {
          name: 'unowned-dashboard',
          title: 'Unowned dashboard',
          resource: 'dashboards',
        },
      ])
    );

    const searcher = new UnifiedSearcher();

    const response = await searcher.search({
      query: '*',
      ownerReference: ['iam.grafana.app/Team/team-a', 'iam.grafana.app/Team/test-team'],
    });

    expect(response.view.length).toBe(1);
    expect(response.view.get(0).name).toBe('Team owned dashboard');
    expect(response.view.get(0).uid).toBe('team-owned-dashboard');
  });
});

describe('toDashboardResults', () => {
  it('can create dashboard search results and set meta sortBy so column is added for sprinkles sort field', () => {
    const mockHits: SearchHit[] = [
      {
        resource: 'dashboards',
        name: 'Main Dashboard',
        title: 'Main Dashboard Title',
        location: '/dashboards/1',
        folder: 'General',
        tags: ['monitoring', 'performance'],
        field: { errors_today: 1 },
        url: '/dashboards/1/main-dashboard-title',
      },
      {
        resource: 'dashboards',
        name: 'Main Dashboard',
        title: 'Main Dashboard Title',
        location: '/dashboards/1',
        folder: 'General',
        tags: ['monitoring', 'performance'],
        field: { errors_today: 2 },
        url: '/dashboards/1/main-dashboard-title',
      },
    ];

    const mockResponse: SearchAPIResponse = {
      totalHits: 2,
      hits: mockHits,
      facets: {},
    };
    const results = toDashboardResults(mockResponse, 'errors_today');

    expect(results.length).toBe(2);
    const sprinklesField = results.fields.find((f) => f.name === 'errors_today');
    expect(sprinklesField).toBeDefined();
    expect(sprinklesField!.name).toBe('errors_today');
    expect(sprinklesField!.values).toEqual([1, 2]); // this also tests the hits original order is preserved
    expect(results.meta?.custom?.sortBy).toBe('errors_today');
  });

  it('will trim "-" from the sort field name', () => {
    const mockHits: SearchHit[] = [
      {
        resource: 'dashboards',
        name: 'Main Dashboard',
        title: 'Main Dashboard Title',
        location: '/dashboards/1',
        folder: 'General',
        tags: ['monitoring', 'performance'],
        field: { errors_today: 1 },
        url: '/dashboards/1/main-dashboard-title',
      },
    ];

    const mockResponse: SearchAPIResponse = {
      totalHits: 0,
      hits: mockHits,
      facets: {},
    };
    const results = toDashboardResults(mockResponse, '-errors_today');

    expect(results.meta?.custom?.sortBy).toBe('errors_today');
  });

  describe('respects appSubUrl in search result URLs', () => {
    const originalAppSubUrl = config.appSubUrl;

    afterEach(() => {
      config.appSubUrl = originalAppSubUrl;
    });

    it('should prepend appSubUrl to folder and dashboard URLs in locationInfo', async () => {
      config.appSubUrl = '/grafana';

      server.use(
        getCustomSearchHandler([
          { name: 'folder1', title: 'Folder 1', resource: 'folders' },
          { name: 'dashboard1', title: 'Dashboard 1', resource: 'dashboards', folder: 'folder1' },
        ])
      );

      const searcher = new UnifiedSearcher();
      const response = await searcher.search({ query: 'test', limit: 50 });

      const locationInfo = response.view.dataFrame.meta?.custom?.locationInfo;
      expect(locationInfo?.general.url).toBe('/grafana/dashboards');
      expect(locationInfo?.folder1.url).toBe('/grafana/dashboards/f/folder1');
    });

    it('should work with empty appSubUrl', async () => {
      config.appSubUrl = '';

      server.use(
        getCustomSearchHandler([
          { name: 'folder1', title: 'Folder 1', resource: 'folders' },
          { name: 'dashboard1', title: 'Dashboard 1', resource: 'dashboards', folder: 'folder1' },
        ])
      );

      const searcher = new UnifiedSearcher();
      const response = await searcher.search({ query: 'test', limit: 50 });

      const locationInfo = response.view.dataFrame.meta?.custom?.locationInfo;
      expect(locationInfo?.general.url).toBe('/dashboards');
      expect(locationInfo?.folder1.url).toBe('/dashboards/f/folder1');
    });
  });
});
