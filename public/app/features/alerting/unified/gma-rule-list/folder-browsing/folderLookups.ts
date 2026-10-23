import { skipToken } from '@reduxjs/toolkit/query';

import { type FolderInfo, useGetFolderParentsQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';

export function useFolderPath(folderUid: string | undefined): string[] | undefined {
  const { data } = useGetFolderParentsQuery(folderUid ? { name: folderUid } : skipToken);
  return data?.items.map((folder: FolderInfo) => folder.title);
}
