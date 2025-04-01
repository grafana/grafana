import { generatedAPI } from './endpoints.gen';

export const folderAPI = generatedAPI.enhanceEndpoints({});

export const { useGetFolderQuery } = folderAPI;
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { type Spec, type Folder } from './endpoints.gen';
