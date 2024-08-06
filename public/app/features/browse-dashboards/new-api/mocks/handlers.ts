import { HttpResponse, delay, http, passthrough } from 'msw';

import { GetFoldersApiResponse, SearchApiResponse } from '../endpoints.gen';

import { folderLayout } from './mockFolderLayout';

export const listFoldersHandler = () =>
  http.get(`/api/folders`, async ({ request }) => {
    const hasMockHeader = request.headers.has('msw-mock');
    if (!hasMockHeader) {
      return passthrough();
    }

    const url = new URL(request.url);

    const pageParam = parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

    const layoutItems = folderLayout.filter((item) => item.kind === 'folder');

    const startIndex = (pageParam - 1) * limit;
    const endIndex = startIndex + limit;

    const folders: GetFoldersApiResponse = layoutItems.slice(startIndex, endIndex).map((item) => {
      return {
        uid: item.uid,
        title: item.title,
      };
    });

    await delay();
    return HttpResponse.json(folders);
  });

export const searchHandler = () =>
  http.get(`/api/search`, async ({ request }) => {
    const hasMockHeader = request.headers.has('msw-mock');
    if (!hasMockHeader) {
      return passthrough();
    }

    const url = new URL(request.url);
    const pageParam = parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

    const layoutItems = folderLayout.filter((item) => item.kind === 'dashboard');

    const startIndex = (pageParam - 1) * limit;
    const endIndex = startIndex + limit;

    const folders: SearchApiResponse = layoutItems.slice(startIndex, endIndex).map((item) => {
      return {
        uid: item.uid,
        title: item.title,
        type: 'dash-db',
      };
    });

    await delay();
    return HttpResponse.json(folders);
  });

export default [listFoldersHandler(), searchHandler()];
