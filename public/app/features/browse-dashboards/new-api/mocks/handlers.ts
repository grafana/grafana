import { HttpResponse, http } from 'msw';

import { GetFoldersApiResponse } from '../endpoints.gen';

import { folderLayout } from './mockFolderLayout';

export const searchHandler = () =>
  http.get(`/api/folders`, () => {
    const folders: GetFoldersApiResponse = folderLayout
      .filter((item) => item.kind === 'folder')
      .map((item) => {
        return {
          uid: item.uid,
          title: item.title,
        };
      });

    return HttpResponse.json(folders);
  });

export default [searchHandler()];
