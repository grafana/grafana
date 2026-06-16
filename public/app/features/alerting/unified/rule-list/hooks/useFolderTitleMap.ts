import { useEffect, useRef, useState } from 'react';

import { useLazyListFolderQuery } from 'app/api/clients/folder/v1beta1';

const FOLDER_PAGE_SIZE = 100;

/**
 * Drains the full folder list and builds a `folderUid -> title` map. Used by the
 * search-backed list view, where rule hits carry only the folder UID but the UI shows
 * the folder title.
 *
 * Scale note (POC): this loads every folder up-front. Fine for typical instances; revisit
 * for instances with very many folders.
 */
export function useFolderTitleMap(): Map<string, string> {
  const [triggerListFolders] = useLazyListFolderQuery();
  const [titleByUid, setTitleByUid] = useState<Map<string, string>>(new Map());
  const didLoad = useRef(false);

  useEffect(() => {
    if (didLoad.current) {
      return;
    }
    didLoad.current = true;

    let cancelled = false;

    async function drain() {
      const map = new Map<string, string>();
      let token: string | undefined;

      do {
        const response = await triggerListFolders({ limit: FOLDER_PAGE_SIZE, continue: token }).unwrap();
        for (const folder of response.items ?? []) {
          const uid = folder.metadata.name;
          if (uid) {
            map.set(uid, folder.spec?.title ?? uid);
          }
        }
        token = response.metadata?.continue;
      } while (token);

      if (!cancelled) {
        setTitleByUid(map);
      }
    }

    drain().catch(() => {
      // Non-blocking: callers fall back to the folder UID when a title is missing.
    });

    return () => {
      cancelled = true;
    };
  }, [triggerListFolders]);

  return titleByUid;
}
