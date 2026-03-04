import { ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { FOLDER_METADATA_FILE } from '../constants';

export function getFolderMetadataPath(sourcePath?: string): string {
  return sourcePath ? `${sourcePath}/${FOLDER_METADATA_FILE}` : FOLDER_METADATA_FILE;
}

/**
 * Returns true if any provisioned folder (resource type 'folders') is missing
 * its `_folder.json` metadata file. Only checks folders that have a resource
 * entry — no more inferring folders from file paths.
 */
export function checkFilesForMissingMetadata(files: Array<{ path?: string }>, resources: ResourceListItem[]): boolean {
  const filePaths = new Set(files.map((f) => f.path).filter(Boolean));

  return resources.some((r) => {
    if (r.resource !== 'folders' || !r.path) {
      return false;
    }
    return !filePaths.has(getFolderMetadataPath(r.path));
  });
}
