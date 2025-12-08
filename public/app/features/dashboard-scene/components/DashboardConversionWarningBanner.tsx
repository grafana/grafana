import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { isV2StoredVersion } from 'app/features/dashboard/api/utils';

import { DashboardScene } from '../scene/DashboardScene';

interface DashboardConversionWarningBannerProps {
  dashboard: DashboardScene;
}

export function DashboardConversionWarningBanner({ dashboard }: DashboardConversionWarningBannerProps) {
  const { meta, isEditing } = dashboard.useState();
  const conversionStatus = meta?.conversionStatus;

  // Show banner if:
  // 1. Dashboard is in edit mode
  // 2. Conversion status exists
  // 3. Conversion didn't fail (dashboard was successfully converted)
  // 4. The stored version is v2 (v2alpha1 or v2beta1), meaning it was converted from v2 to v1
  if (
    !isEditing ||
    !conversionStatus ||
    conversionStatus.failed ||
    !isV2StoredVersion(conversionStatus.storedVersion)
  ) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      title={t(
        'dashboard-scene.conversion-warning-banner.title',
        'This dashboard was converted from the v2 dashboard format'
      )}
      style={{ flex: 0 }}
    >
      <Trans i18nKey="dashboard-scene.conversion-warning-banner.message">
        This dashboard was originally created in the v2 dashboard format and has been converted to the v1 dashboard
        format. Saving changes to this dashboard will lose v2 specific features, like tabs and show/hide rules.
      </Trans>
    </Alert>
  );
}
