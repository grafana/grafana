import { SelectableValue } from '@grafana/data';

import { FolderInfo, PermissionLevelString } from '../../../../types';
import { searchFolders } from '../../../../features/manage-dashboards/state/actions';
import { PermissionLevel } from './types';

interface GetFoldersArgs {
  query: string;
  permissionLevel?: PermissionLevel;
}

async function getFolders({ query, permissionLevel }: GetFoldersArgs): Promise<FolderInfo[]> {
  const searchHits = await searchFolders(query, permissionLevel);
  const folders: FolderInfo[] = searchHits.map((searchHit) => ({
    id: searchHit.id,
    title: searchHit.title,
    url: searchHit.url,
  }));

  return folders;
}

export interface GetFoldersWithEntriesArgs extends GetFoldersArgs {
  extraFolders?: FolderInfo[];
}

async function getFoldersWithEntries({
  query,
  permissionLevel,
  extraFolders,
}: GetFoldersWithEntriesArgs): Promise<FolderInfo[]> {
  const folders = await getFolders({ query, permissionLevel });
  const extra: FolderInfo[] = extraFolders ?? [];
  const filteredExtra = query ? extra.filter((f) => f.title?.toLowerCase().includes(query.toLowerCase())) : extra;
  if (folders) {
    return filteredExtra.concat(folders);
  }

  return filteredExtra;
}

export async function getFoldersAsOptions({
  query,
  permissionLevel = PermissionLevelString.View,
  extraFolders = [],
}: GetFoldersWithEntriesArgs) {
  const folders = await getFoldersWithEntries({ query, permissionLevel, extraFolders });
  return folders.map((value) => {
    const option: SelectableValue<FolderInfo> = { value, label: value.title };
    return option;
  });
}

function isValidFolderId(id?: number) {
  return id !== undefined && id !== null && id >= 0;
}

export function findOptionWithId(
  options?: Array<SelectableValue<FolderInfo>>,
  id?: number
): SelectableValue<FolderInfo> | undefined {
  return options?.find((o) => isValidFolderId(o.value?.id) && isValidFolderId(id) && o.value?.id === id);
}
