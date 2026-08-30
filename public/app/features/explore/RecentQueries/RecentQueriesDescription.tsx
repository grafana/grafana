import { useAsync } from 'react-use';

import { t } from '@grafana/i18n';
import { Text } from '@grafana/ui';
import { getRichHistorySettings } from 'app/core/utils/richHistory';

// Matches the default retention in RichHistoryIndexedDBStorage; used until settings resolve.
const DEFAULT_RETENTION_DAYS = 14;

/**
 * Secondary-text description for the recent queries surfaces. Shared by the OSS recent queries modal
 * and the enterprise saved queries modal so the wording and retention window stay in sync.
 */
export function RecentQueriesDescription() {
  // The retention period is user-configurable, so reflect the real value rather than a hardcoded
  // duration. Falls back to the default until settings resolve.
  const { value: settings } = useAsync(() => getRichHistorySettings(), []);
  const retentionDays = settings?.retentionPeriod ?? DEFAULT_RETENTION_DAYS;

  return (
    <Text color="secondary">
      {t('recent-queries.description', '', {
        count: retentionDays,
        defaultValue_one: "Recent queries are queries that you've run in Explore within the past {{count}} day",
        defaultValue_other: "Recent queries are queries that you've run in Explore within the past {{count}} days",
      })}
    </Text>
  );
}
