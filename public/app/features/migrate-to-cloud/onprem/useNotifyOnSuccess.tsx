import { useRef, useEffect } from 'react';

import { useTranslate } from '@grafana/i18n';
import { TFunction } from '@grafana/i18n/internal';
import { useAppNotification } from 'app/core/copy/appNotification';

import { GetSnapshotResponseDto, SnapshotDto } from '../api';

import { pluralizeResourceName } from './resourceInfo';
import { ResourceTableItem } from './types';

// After the number of distinct resource types migrated exceeeds this value, we display a generic success message.
const SUCCESS_MESSAGE_ITEM_TYPES_THRESHOLD = 4;

export function useNotifySuccessful(snapshot: GetSnapshotResponseDto | undefined) {
  const previousStatusRef = useRef<SnapshotDto['status']>(undefined);
  const notifyApp = useAppNotification();
  const { t } = useTranslate();
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
      const message = getTranslatedMessage(snapshot, t);

      notifyApp.success(title, message);
    }
  }, [notifyApp, snapshot, t]);
}

function getTranslatedMessage(snapshot: GetSnapshotResponseDto, t: TFunction) {
  const types: string[] = [];

  let distinctItems = 0;

  for (const [type, count] of Object.entries(snapshot.stats?.types ?? {})) {
    if (count <= 0) {
      continue;
    }

    // We don't have per-resource status counts, so there's no way to accurately pluralize these
    // so we just don't :)
    const resourceType = pluralizeResourceName(type as ResourceTableItem['type']);
    if (!resourceType) {
      continue;
    }

    types.push(resourceType);

    distinctItems += 1;
  }

  const successCount = snapshot?.stats?.statuses?.['OK'] ?? 0;

  if (distinctItems > SUCCESS_MESSAGE_ITEM_TYPES_THRESHOLD) {
    return t(
      'migrate-to-cloud.onprem.success-message-generic',
      'Successfully migrated {{successCount}} resources to your Grafana Cloud instance.',
      { successCount }
    );
  }

  return t(
    'migrate-to-cloud.onprem.success-message',
    'Successfully migrated {{successCount}} {{types, list}} to your Grafana Cloud instance.',
    { successCount, types }
  );
}
