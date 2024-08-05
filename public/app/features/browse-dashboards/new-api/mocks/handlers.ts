import { HttpResponse, delay, http } from 'msw';

import { GetFoldersApiResponse } from '../endpoints.gen';

import { folderLayout } from './mockFolderLayout';

export const searchHandler = () =>
  http.get(`/api/folders`, async ({ request }) => {
    const url = new URL(request.url);
    const pageParam = parseInt(url.searchParams.get('page') ?? '0', 10);
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

    const layoutItems = folderLayout.filter((item) => item.kind === 'folder');

    const startIndex = pageParam * limit;
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

export default [searchHandler()];
