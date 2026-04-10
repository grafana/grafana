import { css } from '@emotion/css';
import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, useStyles2 } from '@grafana/ui';
import { DASHBOARD_LIBRARY_ROUTES } from 'app/features/dashboard/dashgrid/types';

import { type DashboardScene } from '../scene/DashboardScene';

export function TemplateDashboardUseBanner({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const shouldRender =
    Boolean(searchParams.get('useTemplateBanner')) && location.pathname === DASHBOARD_LIBRARY_ROUTES.Template;
  const [dismissed, setDismissed] = useState<boolean>(!shouldRender);

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
      className={styles.banner}
      onRemove={onDismiss}
    >
      {t('dashboard-scene.template-use-banner.body', 'Save this dashboard and edit it for your use case')}
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  banner: css({
    flex: 0,
    margin: theme.spacing(2, 2, 0, 2),
  }),
});
