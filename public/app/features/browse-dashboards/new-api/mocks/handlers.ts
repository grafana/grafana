import { HttpResponse, JsonBodyType, delay, http, passthrough } from 'msw';

import { GetFoldersApiResponse, SearchApiResponse } from '../endpoints.gen';

import { folderLayout, getChildrenOfFolder } from './mockFolderLayout';

function getItemsOfRange(folderUID: string | undefined, type: 'folder' | 'dashboard', page: number, limit: number) {
  const children = folderUID ? getChildrenOfFolder(folderUID, folderLayout) : folderLayout;

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  return children?.filter((item) => item.kind === type).slice(startIndex, endIndex);
}

export const listFoldersHandler = () =>
  http.get(`/api/folders`, async ({ request }) => {
    const hasMockHeader = request.headers.has('msw-mock');
    if (!hasMockHeader) {
      return passthrough();
    }

    const url = new URL(request.url);

    const pageParam = parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const parentUid = url.searchParams.get('parentUid') ?? undefined;

    const layoutItems = getItemsOfRange(parentUid, 'folder', pageParam, limit);
    if (!layoutItems) {
      return jsonResponse({ error: 'folder not found' }, 404);
    }

    const folders: GetFoldersApiResponse = layoutItems.map((item) => {
      return {
        uid: item.uid,
        title: item.title,
        parentUid: parentUid ?? undefined,
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
    const type = url.searchParams.get('type');
    const folderUids = (url.searchParams.get('folderUIDs') ?? '').split(',');

    if (type !== 'dash-db' || folderUids.length > 1) {
      throw new Error('Unsupported search query');
    }

    const parentUid = folderUids[0] === 'general' ? undefined : folderUids[0];
    const layoutItems = getItemsOfRange(parentUid, 'dashboard', pageParam, limit);
    if (!layoutItems) {
      return jsonResponse({ error: 'folder not found' }, 404);
    }

    const folders: SearchApiResponse = layoutItems.map((item) => {
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

function jsonResponse(data: JsonBodyType, status = 200) {
  return HttpResponse.json(data, { status });
}
