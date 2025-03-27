import { useRef, useEffect } from 'react';

import { useAppNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';

import { GetSnapshotResponseDto, SnapshotDto } from '../api';

// After the number of distinct resource types migrated exceeeds this value, we display a generic success message.
const SUCCESS_MESSAGE_ITEM_TYPES_THRESHOLD = 4;

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

  let distinctItems = 0;

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
    } else if (type === 'LIBRARY_ELEMENT') {
      types.push(t('migrate-to-cloud.migrated-counts.library_elements', 'library elements'));
    } else if (type === 'MUTE_TIMING') {
      types.push(t('migrate-to-cloud.migrated-counts.mute_timings', 'mute timings'));
    } else if (type === 'NOTIFICATION_TEMPLATE') {
      types.push(t('migrate-to-cloud.migrated-counts.notification_templates', 'notification templates'));
    } else if (type === 'CONTACT_POINT') {
      types.push(t('migrate-to-cloud.migrated-counts.contact_points', 'contact points'));
    } else if (type === 'NOTIFICATION_POLICY') {
      types.push(t('migrate-to-cloud.migrated-counts.notification_policies', 'notification policies'));
    } else if (type === 'ALERT_RULE') {
      types.push(t('migrate-to-cloud.migrated-counts.alert_rules', 'alert rules'));
    } else if (type === 'ALERT_RULE_GROUP') {
      types.push(t('migrate-to-cloud.migrated-counts.alert_rule_groups', 'alert rule groups'));
    } else if (type === 'PLUGIN') {
      types.push(t('migrate-to-cloud.migrated-counts.plugins', 'plugins'));
    }

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
