import { css } from '@emotion/css';
import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, TextLink, useStyles2 } from '@grafana/ui';
import { DASHBOARD_LIBRARY_ROUTES } from 'app/features/dashboard/dashgrid/types';

import { type DashboardScene } from '../scene/DashboardScene';

export function TemplateDashboardEditBanner({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const { meta } = dashboard.useState();

  const shouldRender =
    location.pathname === DASHBOARD_LIBRARY_ROUTES.Template &&
    Boolean(meta.isOrgTemplate) &&
    Boolean(meta.orgTemplateUid);

  const [dismissed, setDismissed] = useState<boolean>(!shouldRender);

  if (dismissed || !shouldRender) {
    return null;
  }

  // Falls back to the embedded dashboard's title; the outer template title isn't accessible
  // from OSS without a registry seam into the enterprise RTKQ client (see getOrgTemplateExtension
  // for the pattern). In practice the two titles match at template creation; if they diverge
  // later, we show the dashboard title here and promote to an enterprise-sourced label
  // (option 1) as a follow-up if UX requires.
  const templateName = dashboard.state.title;
  const useTemplateUrl =
    `${DASHBOARD_LIBRARY_ROUTES.Template}?orgTemplateUid=${encodeURIComponent(meta.orgTemplateUid!)}` +
    `&useTemplateBanner=true`;

  return (
    <Alert
      title={t('dashboard-scene.template-edit-banner.title', 'You are editing {{ templateName }}', { templateName })}
      severity="info"
      className={styles.banner}
      onRemove={() => setDismissed(true)}
    >
      <Trans i18nKey="dashboard-scene.template-edit-banner.body">
        Edits made will update this template.{' '}
        <TextLink href={useTemplateUrl} inline>
          If you wish to use this template as a dashboard, click here
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
