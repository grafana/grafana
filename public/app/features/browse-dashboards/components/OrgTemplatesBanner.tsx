import { useLocalStorage } from 'react-use';

import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, TextLink } from '@grafana/ui';

const DISMISS_STORAGE_KEY = 'grafana.org-templates-banner.dismissed';

export function OrgTemplatesBanner() {
  const [dismissed, setDismissed] = useLocalStorage(DISMISS_STORAGE_KEY, false);

  if (!config.featureToggles.orgDashboardTemplates || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <Alert
      severity="info"
      title={t('browse-dashboards.org-templates-banner.title', 'New Feature: Org-defined Templates')}
      onRemove={handleDismiss}
    >
      <Trans i18nKey="browse-dashboards.org-templates-banner.body">
        To manage org-defined templates, view all templates in the{' '}
        <TextLink external={false} href="?templateDashboards=true&source=orgTemplatesBanner">
          template gallery
        </TextLink>
        .
      </Trans>
    </Alert>
  );
}
