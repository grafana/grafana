import { t } from 'i18next';
import { useRef, useEffect } from 'react';

import { useAppNotification } from 'app/core/copy/appNotification';

import { GetSnapshotResponseDto, SnapshotDto } from '../api';

export function useNotifySuccessful(snapshot: GetSnapshotResponseDto | undefined) {
  const previousStatusRef = useRef<SnapshotDto['status']>(undefined);
  const notifyApp = useAppNotification();

  useEffect(() => {
    const status = snapshot?.status;
    const didJustFinish =
      previousStatusRef.current !== 'FINISHED' && previousStatusRef.current !== undefined && status === 'FINISHED';

    previousStatusRef.current = status; // must be AFTER the check above

    if (!didJustFinish) {
      return;
    }

    if (snapshot) {
      const title = t('migrate-to-cloud.onprem.success-title', 'Migration completed!');
      const message = getTranslatedMessage(snapshot);

      notifyApp.success(title, message);
    }
  }, [notifyApp, snapshot]);
}

function getTranslatedMessage(snapshot: GetSnapshotResponseDto) {
  const types: string[] = [];

  for (const [type, count] of Object.entries(snapshot.stats?.types ?? {})) {
    if (count <= 0) {
      continue;
    }

    // We don't have per-resource status counts, so there's no way to accurately pluralize these
    // so we just don't :)
    if (type === 'DASHBOARD') {
      types.push(t('migrate-to-cloud.migrated-counts.dashboards', 'dashboards'));
    } else if (type === 'DATASOURCE') {
      types.push(t('migrate-to-cloud.migrated-counts.datasources', 'data sources'));
    } else if (type === 'FOLDER') {
      types.push(t('migrate-to-cloud.migrated-counts.folders', 'folders'));
    }
  }

  const successCount = snapshot?.stats?.statuses?.['OK'] ?? 0;

  const message = t(
    'migrate-to-cloud.onprem.success-message',
    'Successfully migrated {{successCount}} {{types, list}} to your Grafana Cloud instance.',
    { successCount, types }
  );

  return message;
}
