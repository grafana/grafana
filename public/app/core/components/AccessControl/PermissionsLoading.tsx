import { t } from '@grafana/i18n';
import { LoadingPlaceholder } from '@grafana/ui';

/**
 * The one placeholder for every stage of loading a permissions editor. A stage with its own text shows as a
 * second loader when it hands over to the next.
 */
export function PermissionsLoading() {
  return <LoadingPlaceholder text={t('access-control.permissions.loading', 'Loading permissions...')} />;
}
