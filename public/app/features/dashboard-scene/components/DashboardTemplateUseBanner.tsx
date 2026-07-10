import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaCustomDashboardTemplates } from '@grafana/runtime/internal';
import { Alert, useStyles2 } from '@grafana/ui';
import { DASHBOARD_LIBRARY_ROUTES } from 'app/features/dashboard/dashgrid/types';
import { CustomDashboardTemplateInteractions } from 'app/features/dashboard-scene/analytics/dashboard-templates/main';
import { getDashboardTemplateExtension } from 'app/features/dashboard-scene/settings/enterprise-components/DashboardTemplateExtension';

import { type DashboardScene } from '../scene/DashboardScene';

export function DashboardTemplateUseBanner({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const isCustomDashboardTemplateEnabled = useFlagGrafanaCustomDashboardTemplates();
  const [searchParams] = useSearchParams();
  const { editview } = dashboard.useState();
  // Hide the banner on Settings tabs — settings have their own UI for template editing
  // and the banner is redundant context there.
  const shouldRender =
    isCustomDashboardTemplateEnabled &&
    Boolean(searchParams.get('useTemplateBanner')) &&
    location.pathname === DASHBOARD_LIBRARY_ROUTES.Template &&
    !editview;
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [outerTitle, setOuterTitle] = useState<string | undefined>(undefined);

  const dashboardTemplateUid = searchParams.get('dashboardTemplateUid') ?? undefined;

  useEffect(() => {
    if (!shouldRender || !dashboardTemplateUid) {
      return;
    }
    getDashboardTemplateExtension()
      .loadTemplate(dashboardTemplateUid)
      .then((resource) => {
        setOuterTitle(resource.spec.title);
      });
  }, [shouldRender, dashboardTemplateUid]);

  const onDismiss = () => {
    CustomDashboardTemplateInteractions.templateUseBannerDismissed({
      templateUid: dashboardTemplateUid ?? '',
    });
    setDismissed(true);
  };

  if (dismissed || !shouldRender) {
    return null;
  }

  return (
    <Alert
      title={t(
        'dashboard-scene.dashboard-template-use-banner.title',
        'You are using {{ templateName }} template in a new dashboard',
        { templateName: outerTitle ?? dashboard.state.title }
      )}
      severity="success"
      className={styles.banner}
      onRemove={onDismiss}
    >
      {t('dashboard-scene.dashboard-template-use-banner.body', 'Save this dashboard and edit it for your use case')}
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  banner: css({
    flex: 0,
    margin: theme.spacing(2, 2, 0, 2),
  }),
});
