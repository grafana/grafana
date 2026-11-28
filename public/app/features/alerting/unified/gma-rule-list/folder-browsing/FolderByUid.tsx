import { FolderPath } from '../rule-row/FolderPath';

import { useFolderPath } from './folderLookups';

interface FolderByUidProps {
  folderUid: string;
  showIcon?: boolean;
}

/** Resolves a folder UID to its path segments and renders them with FolderPath. */
export function FolderByUid({ folderUid, showIcon }: FolderByUidProps) {
  const path = useFolderPath(folderUid);
  if (!path) {
    return null;
  }
  return <FolderPath segments={path} showIcon={showIcon} />;
}
