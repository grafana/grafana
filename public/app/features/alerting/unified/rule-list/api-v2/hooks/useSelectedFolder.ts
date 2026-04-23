import { useCallback, useMemo } from 'react';

import { useURLSearchParams } from '../../../hooks/useURLSearchParams';
import { type SelectedView } from '../lib/types';

const PARAM = 'folder';

export interface UseSelectedFolderResult {
  view: SelectedView;
  selectFolder: (dataSourceUid: string, folderKey: string) => void;
  selectDeleted: () => void;
  clear: () => void;
}

export function useSelectedFolder(): UseSelectedFolderResult {
  const [params, update] = useURLSearchParams();
  const raw = params.get(PARAM);

  const view = useMemo<SelectedView>(() => parseParam(raw), [raw]);

  const selectFolder = useCallback(
    (dataSourceUid: string, folderKey: string) => {
      update({ [PARAM]: `ds:${encodeURIComponent(dataSourceUid)}/${encodeURIComponent(folderKey)}` });
    },
    [update]
  );

  const selectDeleted = useCallback(() => {
    update({ [PARAM]: 'deleted' });
  }, [update]);

  const clear = useCallback(() => {
    update({ [PARAM]: undefined });
  }, [update]);

  return { view, selectFolder, selectDeleted, clear };
}

function parseParam(raw: string | null): SelectedView {
  if (!raw) {
    return { kind: 'empty' };
  }
  if (raw === 'deleted') {
    return { kind: 'deleted' };
  }
  if (raw.startsWith('ds:')) {
    const rest = raw.slice(3);
    const slash = rest.indexOf('/');
    if (slash === -1) {
      return { kind: 'empty' };
    }
    return {
      kind: 'folder',
      folder: {
        dataSourceUid: decodeURIComponent(rest.slice(0, slash)),
        folderKey: decodeURIComponent(rest.slice(slash + 1)),
      },
    };
  }
  return { kind: 'empty' };
}
