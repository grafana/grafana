import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

export function TemplateUseBanner({ dashboard }: { dashboard: DashboardScene }) {
  const [dismissed, setDismissed] = useState<boolean>(false);

  const onDismiss = () => {
    setDismissed(true);
  };

  if (dismissed) {
    return null;
  }

  return (
    <Alert
      title={t(
        'dashboard-scene.template-use-banner.title',
        'You are using {{ templateName }} template in a new dashboard',
        { templateName: dashboard.state.title }
      )}
      severity="success"
      style={{ flex: 0 }}
      onRemove={onDismiss}
    >
      {t('dashboard-scene.template-use-banner.body', 'Save this dashboard and edit it for your use case')}
    </Alert>
  );
}
