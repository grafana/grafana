import { Trans, t } from '@grafana/i18n';
import { Alert, LinkButton, Stack, Text } from '@grafana/ui';

import { ALERTING_PATHS } from '../../utils/navigation';
import { createRelativeUrl } from '../../utils/url';

import { useImportToGMABannerPrefs } from './useImportToGMABannerPrefs';

/**
 * Promotes the Import to GMA wizard, inviting users to import their external Alertmanager
 * configuration into Grafana-managed alerting. Owns only its dismissal state; callers decide
 * whether to render it (the eligibility gate — feature flag, external Alertmanager, and
 * permissions — differs per page).
 */
export function ImportToGMABanner() {
  const { bannerIsDismissed, dismissBanner } = useImportToGMABannerPrefs();

  if (bannerIsDismissed) {
    return null;
  }

  return (
    <Alert
      severity="info"
      title={t('alerting.import-to-gma-banner.title', 'Import your external Alertmanager into Grafana')}
      onRemove={dismissBanner}
    >
      <Stack direction="column" gap={2}>
        <Text>
          <Trans i18nKey="alerting.import-to-gma-banner.description">
            Bring your external Alertmanager configuration into Grafana-managed alerting using the import wizard.
          </Trans>
        </Text>
        <div>
          <LinkButton href={createRelativeUrl(ALERTING_PATHS.IMPORT_TO_GMA)} variant="primary" size="sm">
            <Trans i18nKey="alerting.import-to-gma-banner.open-button">Import to Grafana Alerting</Trans>
          </LinkButton>
        </div>
      </Stack>
    </Alert>
  );
}
