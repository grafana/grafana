import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useFlagGrafanaCustomDashboardTemplates } from '@grafana/runtime/internal';
import { Alert, TextLink, useStyles2 } from '@grafana/ui';
import { DASHBOARD_LIBRARY_ROUTES } from 'app/features/dashboard/dashgrid/types';

import { type DashboardScene } from '../scene/DashboardScene';
import { getDashboardTemplateExtension } from '../settings/enterprise-components/DashboardTemplateExtension';

export function DashboardTemplateEditBanner({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const isCustomDashboardTemplateEnabled = useFlagGrafanaCustomDashboardTemplates();
  const { meta, editview } = dashboard.useState();

  const dashboardTemplateUid = meta.dashboardTemplateUid;

  // Hide the banner on Settings tabs — they have their own dedicated UI for template
  // editing, and the banner is redundant context there.
  const shouldRender =
    isCustomDashboardTemplateEnabled &&
    location.pathname === DASHBOARD_LIBRARY_ROUTES.Template &&
    Boolean(meta.isDashboardTemplate) &&
    Boolean(dashboardTemplateUid) &&
    !editview;

  const [dismissed, setDismissed] = useState<boolean>(false);
  const [outerTitle, setOuterTitle] = useState<string>();

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

  if (dismissed || !shouldRender || !dashboardTemplateUid) {
    return null;
  }

  const templateName = outerTitle ?? dashboard.state.title;
  const useTemplateUrl =
    `${DASHBOARD_LIBRARY_ROUTES.Template}?dashboardTemplateUid=${encodeURIComponent(dashboardTemplateUid)}` +
    `&useTemplateBanner=true`;

  return (
    <Alert
      title={t('dashboard-scene.dashboard-template-edit-banner.title', 'You are editing {{ templateName }}', {
        templateName,
      })}
      severity="info"
      className={styles.banner}
      onRemove={() => setDismissed(true)}
    >
      <Trans i18nKey="dashboard-scene.dashboard-template-edit-banner.body">
        Edits made will update this template.{' '}
        <TextLink href={useTemplateUrl} inline>
          If you wish to use this template to create a dashboard, click here
        </TextLink>
      </Trans>
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  banner: css({
    flex: 0,
    margin: theme.spacing(2, 2, 0, 2),
  }),
});
