import { useFolderPath } from '../folder-browsing/folderLookups';
import { FolderPath } from '../rule-row/FolderPath';

interface DeletedRuleFolderPathProps {
  folderUid: string | undefined;
  fallback: string;
}

/** A folder that cannot be resolved keeps its UID rather than disabling the row. */
export function DeletedRuleFolderPath({ folderUid, fallback }: DeletedRuleFolderPathProps) {
  const path = useFolderPath(folderUid);
  if (path && path.length > 0) {
    return <FolderPath segments={path} />;
  }
  return <>{folderUid ?? fallback}</>;
}
