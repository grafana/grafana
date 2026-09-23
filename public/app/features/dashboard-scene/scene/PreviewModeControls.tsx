import { t } from '@grafana/i18n';
import { useFlagGrafanaDashboardPreviewMode } from '@grafana/runtime/internal';
import { InlineSwitch } from '@grafana/ui';

import { type DashboardScene } from './DashboardScene';
import { isDashboardReviewing } from './types/dashboard';

interface Props {
  dashboard: DashboardScene;
}

export function PreviewModeControls({ dashboard }: Props) {
  const enabled = useFlagGrafanaDashboardPreviewMode();
  const state = dashboard.useState();
  const reviewing = isDashboardReviewing(state);

  if ((!enabled && !reviewing) || !state.isEditing || state.editPanel || state.editview || state.viewPanel) {
    return null;
  }

  return (
    <InlineSwitch
      label={t('dashboard.preview.toggle', 'Preview')}
      showLabel
      value={reviewing}
      onChange={() => dashboard.setEditPresentation(reviewing ? 'full' : 'preview')}
    />
  );
}
