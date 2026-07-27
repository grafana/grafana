import { type Condition } from 'app/api/clients/provisioning/v0alpha1';

import { FOLDER_METADATA_FILE } from '../constants';

export function getFolderMetadataPath(sourcePath?: string): string {
  return sourcePath ? `${sourcePath}/${FOLDER_METADATA_FILE}` : FOLDER_METADATA_FILE;
}

export function isFolderMetadataPath(path: string): boolean {
  return path === FOLDER_METADATA_FILE || path.endsWith(`/${FOLDER_METADATA_FILE}`);
}

/**
 * For a _folder.json path, returns the resource hash of the parent folder it describes
 * (the synced metadata hash). Returns undefined for root-level _folder.json (no parent
 * folder exists) or when the parent folder has no resource.
 */
export function getParentFolderResourceHash(
  metadataPath: string,
  getResourceHashByPath: (path: string) => string | undefined
): string | undefined {
  const lastSlash = metadataPath.lastIndexOf('/');
  if (lastSlash === -1) {
    return undefined;
  }
  return getResourceHashByPath(metadataPath.substring(0, lastSlash));
}

/** Returns true when the backend's PullStatus condition reports missing _folder.json metadata. */
export function hasMissingFolderMetadata(conditions: Condition[] | undefined): boolean {
  const condition = conditions?.find((c) => c.type === 'PullStatus');
  return condition?.reason === 'MissingFolderMetadata';
}
