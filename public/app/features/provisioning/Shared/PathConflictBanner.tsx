import { Alert } from '@grafana/ui';

import { getPathConflictWarningTitle } from '../utils/pathConflict';

interface PathConflictBannerProps {
  message: string;
}

/**
 * Warning shown when a repository's URL/branch/path overlaps with another repository.
 * This is informational only - Grafana's manager-identity check on synced resources
 * already prevents the two repositories from overwriting each other's content.
 */
export function PathConflictBanner({ message }: PathConflictBannerProps) {
  return (
    <Alert severity="warning" title={getPathConflictWarningTitle()}>
      {message}
    </Alert>
  );
}
