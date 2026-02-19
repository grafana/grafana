import { BackendSrv } from '@grafana/runtime';

import { GrafanaSearcher, SearchQuery } from './types';
import { toDashboardResults, SearchHit, SearchAPIResponse, UnifiedSearcher } from './unified';

beforeEach(() => {
  jest.clearAllMocks();
});

const mockResults: SearchAPIResponse = {
  hits: [],
  totalHits: 0,
};

const mockFolders: SearchAPIResponse = {
  hits: [],
  totalHits: 0,
};

const mockFallbackSearcher = {
  search: jest.fn(),
} as unknown as GrafanaSearcher;

const getResponse = (uri: string) => {
  if (uri.includes('?type=folders')) {
    return Promise.resolve(mockFolders);
  }
  return Promise.resolve(mockResults);
};

const mockSearcher = {
  search: (uri: string) => getResponse(uri),
};

jest.mock('@grafana/runtime', () => {
  const originalRuntime = jest.requireActual('@grafana/runtime');
  return {
    ...originalRuntime,
    getBackendSrv: () =>
      ({
        get: (uri: string) => mockSearcher.search(uri),
      }) as unknown as BackendSrv,
  };
});

describe('Unified Storage Searcher', () => {
  it('should perform search with basic query', async () => {
    mockFolders.hits = [
      {
        name: 'folder1',
        title: 'Folder 1',
        resource: 'folders',
      } as SearchHit,
    ];
    mockResults.hits = [
      {
        name: 'dashboard1',
        title: 'Dashboard 1',
        resource: 'dashboards',
        folder: 'folder1',
      } as SearchHit,
    ];

    const query: SearchQuery = {
      query: 'test',
      limit: 50,
    };

    const searcher = new UnifiedSearcher(mockFallbackSearcher);

    const response = await searcher.search(query);

    expect(response.view.length).toBe(1);
    expect(response.view.get(0).title).toBe('Dashboard 1');

    const df = response.view.dataFrame;
    const locationInfo = df.meta?.custom?.locationInfo;
    expect(locationInfo).toBeDefined();
    expect(locationInfo?.folder1.name).toBe('Folder 1');
  });

  it('should perform search and sync folders with missing folder', async () => {
    const mockFolders = {
      hits: [
        {
          name: 'folder2',
          title: 'Folder 2',
          resource: 'folders',
        } as SearchHit,
      ],
      totalHits: 1,
    };

    const mockResults = {
      hits: [
        {
          name: 'db1',
          title: 'DB 1',
          resource: 'dashboards',
          folder: 'folder1',
        } as SearchHit,
        {
          name: 'db2',
          title: 'DB 2',
          resource: 'dashboards',
          folder: 'folder2',
        } as SearchHit,
      ],
      totalHits: 2,
    };

    jest
      .spyOn(mockSearcher, 'search')
      .mockResolvedValueOnce(mockFolders)
      .mockResolvedValueOnce(mockResults)
      .mockResolvedValueOnce(mockFolders);

    const query: SearchQuery = {
      query: 'test',
      limit: 50,
    };

    const searcher = new UnifiedSearcher(mockFallbackSearcher);

    const response = await searcher.search(query);

    expect(response.view.length).toBe(2);
    expect(response.view.get(0).title).toBe('DB 1');
    expect(response.view.get(0).folder).toBe('sharedwithme');
    expect(response.view.get(1).title).toBe('DB 2');

    const df = response.view.dataFrame;
    const locationInfo = df.meta?.custom?.locationInfo;
    expect(locationInfo).toBeDefined();
    expect(locationInfo?.folder2.name).toBe('Folder 2');
    expect(mockSearcher.search).toHaveBeenCalledTimes(3);
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
    const sprinklesField = results.fields[10];
    expect(sprinklesField.name).toBe('errors_today');
    expect(sprinklesField.values).toEqual([1, 2]); // this also tests the hits original order is preserved
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
