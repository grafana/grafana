import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { type Condition } from 'app/api/clients/provisioning/v0alpha1';

import { getPathConflictCondition } from '../utils/pathConflict';

interface PathConflictBannerProps {
  conditions: Condition[] | undefined;
}

/**
 * Warning shown when a repository's URL/branch/path overlaps with another repository.
 * This is informational only - Grafana's manager-identity check on synced resources
 * already prevents the two repositories from overwriting each other's content.
 */
export function PathConflictBanner({ conditions }: PathConflictBannerProps) {
  const pathConflict = getPathConflictCondition(conditions);
  if (!pathConflict) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      title={t(
        'provisioning.path-conflict-banner.title',
        'This repository shares a url, branch, and path combination with another repository. There will be sync errors because resources can only be managed by 1 repository.'
      )}
    >
      {pathConflict.message}
    </Alert>
  );
}
