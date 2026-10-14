import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { useAppNotification } from 'app/core/copy/appNotification';

/** Warns that migration removed filters, naming their keys only: values can hold names and UIDs. */
export function useDroppedFiltersWarning(): (droppedKeys: string[]) => void {
  const notifyApp = useAppNotification();

  return useCallback(
    (droppedKeys: string[]) => {
      if (droppedKeys.length === 0) {
        return;
      }
      notifyApp.warning(
        t('alerting.gma-rule-list.migration-dropped-title', 'Some filters were removed'),
        t(
          'alerting.gma-rule-list.migration-dropped-text',
          'These filters could not be migrated and were removed: {{filters}}',
          { filters: droppedKeys.join(', ') }
        )
      );
    },
    [notifyApp]
  );
}
