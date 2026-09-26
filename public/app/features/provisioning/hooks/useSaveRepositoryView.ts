import { isRootFolderUID } from 'app/features/search/constants';

import { type RepositoryViewData, useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export type SaveTarget = 'repository' | 'database';

export interface SaveRepositoryView extends RepositoryViewData {
  /** The save must go through a repository */
  isProvisioned: boolean;
  /** The root of a folderless repository is the one place a new resource can go either way */
  canChooseTarget: boolean;
}

interface SaveRepositoryArgs {
  /** Folder the resource is headed to; "" and "general" mean the root */
  folderUid?: string;
  /** Repository a previewed or copied file came from; yields to the folder when it is gone */
  name?: string;
  /** Known from an annotation, so it settles without waiting on the lookup */
  isManaged?: boolean;
  /** A stored resource resolves from its own manager, never from the folder it sits in */
  isNew?: boolean;
}

/** Resolves where a dashboard or folder is saved, so every save surface follows the same rule */
export function useSaveRepositoryView({
  folderUid,
  name,
  isManaged,
  isNew = true,
}: SaveRepositoryArgs): SaveRepositoryView {
  const targetFolderUid = isRootFolderUID(folderUid) ? undefined : folderUid;
  const view = useGetResourceRepositoryView({
    name,
    folderName: isNew ? targetFolderUid : undefined,
    includeFolderless: isNew && !targetFolderUid,
  });
  return {
    ...view,
    // isInstanceManaged is not counted: a Ready lookup already resolves it as `repository`, so it would
    // only add orphaned dead ends
    isProvisioned: Boolean(isManaged) || Boolean(view.repository),
    canChooseTarget: isNew && !targetFolderUid && view.repository?.target === 'folderless',
  };
}

/** Where the save goes: the user's pick where a choice exists, otherwise wherever the lookup says */
export function getSaveTarget(
  view: Pick<SaveRepositoryView, 'isProvisioned' | 'canChooseTarget'>,
  chosen?: SaveTarget
): SaveTarget {
  return view.canChooseTarget && chosen ? chosen : view.isProvisioned ? 'repository' : 'database';
}
