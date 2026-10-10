import { useCallback, useRef, useState } from 'react';

import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';

import { duplicateNotebook } from '../api/notebookResource';
import { notebookEditUrl } from '../urls';

export function useDuplicateNotebook() {
  const [isDuplicating, setIsDuplicating] = useState(false);
  const inFlight = useRef(false);
  const notifyApp = useAppNotification();

  const duplicate = useCallback(
    async (uid: string, beforeDuplicate?: () => Promise<void>) => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      setIsDuplicating(true);
      try {
        await beforeDuplicate?.();
        const created = await duplicateNotebook(uid);
        locationService.push(notebookEditUrl(created.uid));
      } catch (error) {
        notifyApp.error(
          t('notebooks.duplicate.error', 'Failed to duplicate notebook'),
          error instanceof Error ? error.message : undefined
        );
      } finally {
        inFlight.current = false;
        setIsDuplicating(false);
      }
    },
    [notifyApp]
  );

  return { duplicate, isDuplicating };
}
