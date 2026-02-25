import { FOLDER_METADATA_FILE } from '../constants';

export function getFolderMetadataPath(sourcePath?: string): string {
  return sourcePath ? `${sourcePath}/${FOLDER_METADATA_FILE}` : FOLDER_METADATA_FILE;
}
