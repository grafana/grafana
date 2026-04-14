import { type Condition } from 'app/api/clients/provisioning/v0alpha1';

import { FOLDER_METADATA_FILE } from '../constants';

export function getFolderMetadataPath(sourcePath?: string): string {
  return sourcePath ? `${sourcePath}/${FOLDER_METADATA_FILE}` : FOLDER_METADATA_FILE;
}

/** Returns true when the backend's PullStatus condition reports missing _folder.json metadata. */
export function hasMissingFolderMetadata(conditions: Condition[] | undefined): boolean {
  const condition = conditions?.find((c) => c.type === 'PullStatus');
  return condition?.reason === 'MissingFolderMetadata';
}
