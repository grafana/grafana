import { t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { getStatusFromError } from 'app/core/utils/errors';

/** Explains why a section could not be loaded. Without an error it reports a generic failure. */
export function LoadError({ error }: { error?: unknown }) {
  const status = getStatusFromError(error);
  let title = t('admin.user-overview.load-error', 'Unable to load this information. Please try again.');
  if (status === 403) {
    title = t('admin.user-overview.forbidden', 'You do not have permission to view this information');
  } else if (status === 404) {
    title = t('admin.user-overview.not-found', 'This information is not available');
  }
  return <Alert severity="warning" title={title} />;
}

/** Stands in for a section that has no data yet: the failure if there is one, else a loading indicator. */
export function LoadState({ error }: { error?: unknown }) {
  return error ? (
    <LoadError error={error} />
  ) : (
    <LoadingPlaceholder text={t('admin.user-overview.loading', 'Loading…')} />
  );
}
