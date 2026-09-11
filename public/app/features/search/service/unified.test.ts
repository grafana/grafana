import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import { type Store } from 'redux';

import { config, setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, searchRoute, starsRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { backendSrv } from 'app/core/services/backend_srv';
import { setStore } from 'app/store/store';

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

  describe('starred', () => {
    const starsHandler = (resources: Array<{ group: string; kind: string; names: string[] }>) =>
      http.get(starsRoute, () =>
        HttpResponse.json({
          kind: 'StarsList',
          apiVersion: 'collections.grafana.app/v1alpha1',
          metadata: { resourceVersion: '1' },
          items: [
            {
              metadata: { name: 'user-u000000001', namespace: 'default', resourceVersion: '1' },
              spec: { resource: resources },
            },
          ],
        })
      );

    const bothStarredResources = [
      { group: 'dashboard.grafana.app', kind: 'Dashboard', names: ['d1'] },
      { group: 'folder.grafana.app', kind: 'Folder', names: ['f1'] },
    ];

    // Root-level hits (no folder) so the searcher's folder-cache staleness check stays quiet.
    const starredHits = [
      { resource: 'dashboards', name: 'd1', title: 'Dashboard 1', field: {} },
      { resource: 'folders', name: 'f1', title: 'Folder 1', field: {} },
    ];

    let searchRequests: URL[] = [];

    // The searcher also hits the search endpoint for location info, so capture
    // every request and let assertions pick out the one carrying name filters.
    const captureSearchHandler = (hits: Array<Record<string, unknown>>) =>
      http.get(searchRoute, ({ request }) => {
        searchRequests.push(new URL(request.url));
        return HttpResponse.json({ totalHits: hits.length, hits });
      });

    const findStarredSearchRequest = () => searchRequests.find((url) => url.searchParams.getAll('name').length > 0);

    beforeEach(() => {
      searchRequests = [];
      config.featureToggles.foldersAppPlatformAPI = true;
      setTestFlags({ 'grafana.starredFolders': true });
      // starred() reads stars via an RTK Query dispatch on the global store, so wire one up.
      const store = configureStore({
        reducer: { [collectionsAPIv1alpha1.reducerPath]: collectionsAPIv1alpha1.reducer },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(collectionsAPIv1alpha1.middleware),
      });
      setStore(store as unknown as Store);
    });

    afterEach(() => {
      config.featureToggles.foldersAppPlatformAPI = false;
      setTestFlags({});
    });

    it('searches for starred folders alongside dashboards when starred folders are enabled', async () => {
      server.use(starsHandler(bothStarredResources), captureSearchHandler(starredHits));

      const searcher = new UnifiedSearcher();
      const response = await searcher.starred({ kind: ['dashboard', 'folder'] });

      expect(findStarredSearchRequest()?.searchParams.getAll('name')).toEqual(['d1', 'f1']);

      expect(response.totalRows).toBe(2);
      const folderHit = response.view.get(1);
      expect(folderHit.kind).toBe('folder');
      expect(folderHit.url).toContain('/dashboards/f/f1');
    });

    it('keeps the search dashboards-only when the starred folders flag is off', async () => {
      setTestFlags({});
      server.use(starsHandler(bothStarredResources), captureSearchHandler(starredHits.slice(0, 1)));

      const searcher = new UnifiedSearcher();
      await searcher.starred({ kind: ['dashboard', 'folder'] });

      expect(findStarredSearchRequest()?.searchParams.getAll('name')).toEqual(['d1']);
    });

    it('returns an empty response without searching when nothing is starred', async () => {
      server.use(starsHandler([]), captureSearchHandler([]));

      const searcher = new UnifiedSearcher();
      const response = await searcher.starred({ kind: ['dashboard', 'folder'] });

      expect(response.totalRows).toBe(0);
      expect(findStarredSearchRequest()).toBeUndefined();
    });
  });
});

describe('toDashboardResults', () => {
  it('can create dashboard search results and set meta sortBy so column is added for sprinkles sort field', () => {
    const mockHits: SearchHit[] = [
      {
        resource: 'dashboards',
        name: 'Main Dashboard',
        title: 'Main Dashboard Title',
        folder: 'General',
        tags: ['monitoring', 'performance'],
        field: { errors_today: 1 },
        url: '/dashboards/1/main-dashboard-title',
      },
      {
        resource: 'dashboards',
        name: 'Main Dashboard',
        title: 'Main Dashboard Title',
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

  it('always includes a description field even when the first hit has no description', () => {
    const mockHits: SearchHit[] = [
      {
        resource: 'dashboards',
        name: 'no-description',
        title: 'No description',
        folder: 'General',
        tags: [],
        field: {},
        url: '/d/no-description',
      },
      {
        resource: 'dashboards',
        name: 'has-description',
        title: 'Has description',
        description: 'A helpful description',
        folder: 'General',
        tags: [],
        field: {},
        url: '/d/has-description',
      },
    ];

    const mockResponse: SearchAPIResponse = {
      totalHits: 2,
      hits: mockHits,
      facets: {},
    };
    const results = toDashboardResults(mockResponse, '');

    const descriptionField = results.fields.find((f) => f.name === 'description');
    expect(descriptionField).toBeDefined();
    expect(descriptionField!.values).toEqual(['', 'A helpful description']);
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
