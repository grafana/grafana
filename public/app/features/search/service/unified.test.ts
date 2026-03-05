import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { GrafanaSearcher, SearchQuery } from './types';
import { toDashboardResults, SearchHit, SearchAPIResponse, UnifiedSearcher } from './unified';

beforeEach(() => {
  jest.clearAllMocks();
});

const mockFallbackSearcher = {
  search: jest.fn(),
} as unknown as GrafanaSearcher;

setBackendSrv(backendSrv);
setupMockServer();

describe('Unified Storage Searcher', () => {
  it('should perform search with basic query', async () => {
    const query: SearchQuery = {
      query: 'test',
      limit: 50,
    };

    server.use(
      getCustomSearchHandler({
        folders: [{ name: 'folder1', title: 'Folder 1', resource: 'folders' }],
        dashboards: [{ name: 'dashboard1', title: 'Dashboard 1', resource: 'dashboards', folder: 'folder1' }],
      })
    );

    const searcher = new UnifiedSearcher(mockFallbackSearcher);

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
      getCustomSearchHandler({
        folders: [{ name: 'folder2', title: 'Folder 2', resource: 'folders' }],
        dashboards: [
          { name: 'db1', title: 'DB 1', resource: 'dashboards', folder: 'folder1' },
          { name: 'db2', title: 'DB 2', resource: 'dashboards', folder: 'folder2' },
        ],
      })
    );

    const query: SearchQuery = {
      query: 'test',
      limit: 50,
    };

    const searcher = new UnifiedSearcher(mockFallbackSearcher);

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

  it('can create dashboard search results and set meta sortBy so column is added for sprinkles sort field', () => {
    const mockHits: SearchHit[] = [
      {
        resource: 'dashboard',
        name: 'Main Dashboard',
        title: 'Main Dashboard Title',
        location: '/dashboards/1',
        folder: 'General',
        tags: ['monitoring', 'performance'],
        field: { errors_today: 1 },
        url: '/dashboards/1/main-dashboard-title',
      },
      {
        resource: 'dashboard',
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
        resource: 'dashboard',
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
});
