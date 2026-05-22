import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, TextLink, useStyles2 } from '@grafana/ui';
import { getDashboardTemplateExtension } from 'app/features/dashboard-scene/settings/enterprise-components/DashboardTemplateExtension';

export function DashboardTemplateSavedBanner() {
  const styles = useStyles2(getStyles);
  const [searchParams, setSearchParams] = useSearchParams();
  const [templateName, setTemplateName] = useState<string | undefined>(undefined);

  const dashboardTemplateUid = searchParams.get('templateSaved') ?? undefined;

  useEffect(() => {
    if (!dashboardTemplateUid) {
      return;
    }
    getDashboardTemplateExtension()
      .loadTemplate(dashboardTemplateUid)
      .then((resource) => {
        setTemplateName(resource.spec.title);
      });
  }, [dashboardTemplateUid]);

  const onDismiss = () => {
    searchParams.delete('templateSaved');
    setSearchParams(searchParams);
  };

  const onOpenGallery = () => {
    searchParams.set('templateDashboards', 'true');
    setSearchParams(searchParams);
  };

  // Hide the banner on Settings tabs — `editview` is set in the URL whenever a settings
  // tab is active. Settings have their own UI for template editing and the banner is
  // redundant context there.
  const onSettingsTab = Boolean(searchParams.get('editview'));

  if (!dashboardTemplateUid || !templateName || onSettingsTab) {
    return null;
  }

  return (
    <Alert
      title={t('dashboard-scene.dashboard-template-saved-banner.title', 'Template created')}
      severity="success"
      className={styles.banner}
      onRemove={onDismiss}
    >
      <Trans i18nKey="dashboard-scene.dashboard-template-saved-banner.body" values={{ templateName }}>
        {'The {{ templateName }} template was created. You can access it in the '}
        <TextLink
          href=""
          onClick={(e) => {
            e.preventDefault();
            onOpenGallery();
          }}
          inline
        >
          template gallery
        </TextLink>
        .
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
