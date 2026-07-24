import { useEffect } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, EmptyState, LinkButton, LoadingPlaceholder, Stack, Text, TextLink } from '@grafana/ui';

import { logError } from '../../Analytics';
import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { WithReturnButton } from '../../components/WithReturnButton';
import { AutoSyncConfiguration } from '../../components/settings/AutoSyncConfiguration';
import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { DOCS_URL_ALERTING_MIGRATION } from '../../utils/docs';
import { stringifyErrorLike } from '../../utils/misc';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { useSettingsPageNav } from '../navigation';

import { StagedConfiguration } from './StagedConfiguration';
import { isStagedExtraConfig } from './stagedConfig';

const IMPORT_WIZARD_URL = '/alerting/import-to-gma';

function ImportSettingsPage() {
  const { navId, pageNav } = useSettingsPageNav();

  return (
    <AlertingPageWrapper
      navId={navId}
      pageNav={pageNav}
      actions={[
        <WithReturnButton
          key="add-alertmanager"
          title={t('alerting.settings-content.title-alerting-settings', 'Alerting settings')}
          component={
            <LinkButton href="/connections/datasources/alertmanager" icon="plus" variant="primary">
              <Trans i18nKey="alerting.settings-content.add-new-alertmanager">Add new Alertmanager</Trans>
            </LinkButton>
          }
        />,
      ]}
    >
      <AlertmanagerProvider accessType="notification" alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
        <ImportSettingsContent />
      </AlertmanagerProvider>
    </AlertingPageWrapper>
  );
}

function ImportSettingsContent() {
  const isAutoSyncEnabled = config.featureToggles['alerting.syncExternalAlertmanager'];

  return (
    <Stack direction="column" gap={2}>
      {isAutoSyncEnabled && <AutoSyncConfiguration />}
      <StagedConfigurationSection />
    </Stack>
  );
}

function StagedConfigurationSection() {
  const [, canView] = useAlertmanagerAbility(AlertmanagerAction.ViewExternalConfiguration);
  const { data, isLoading, isError, error, refetch } = useAlertmanagerConfig(
    canView ? GRAFANA_RULES_SOURCE_NAME : undefined
  );

  useEffect(() => {
    if (isError) {
      logError(new Error(stringifyErrorLike(error)));
    }
  }, [isError, error]);

  // A user can have at most one staged configuration at a time
  const rawStagedConfig: unknown = data?.extra_config?.[0];
  const stagedConfig = isStagedExtraConfig(rawStagedConfig) ? rawStagedConfig : undefined;

  return (
    <Stack direction="column" gap={1}>
      <Text variant="h4">
        <Trans i18nKey="alerting.settings.import.staged-title">Staged configuration</Trans>
      </Text>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.settings.import.staged-description">
          A read-only, reversible copy of an imported Alertmanager config. Promote it to merge into your live config, or
          revert to remove it.
        </Trans>
      </Text>

      {!canView ? (
        <Alert
          severity="info"
          title={t(
            'alerting.settings.import.no-permission-title',
            "You don't have permission to view imported configurations"
          )}
        >
          <Trans i18nKey="alerting.settings.import.no-permission-body">
            Contact your administrator to request access to imported Alertmanager configurations.
          </Trans>
        </Alert>
      ) : (
        <>
          {isLoading && (
            <LoadingPlaceholder text={t('alerting.settings.import.loading', 'Loading imported configurations…')} />
          )}

          {isError && (
            <Alert
              severity="error"
              title={t('alerting.settings.import.error-title', "Couldn't load imported configurations")}
            >
              <Stack direction="column" gap={2} alignItems="flex-start">
                <Trans i18nKey="alerting.settings.import.error-body">
                  The request to the Alerting API failed. Check your connection and try again.
                </Trans>
                <Button variant="secondary" fill="outline" icon="sync" onClick={() => refetch()}>
                  <Trans i18nKey="alerting.settings.import.error-retry">Retry</Trans>
                </Button>
              </Stack>
            </Alert>
          )}

          {!isLoading && !isError && !stagedConfig && (
            <EmptyState
              variant="call-to-action"
              message={t('alerting.settings.import.empty-title', 'No configuration imported yet')}
              button={
                <LinkButton icon="cloud-upload" size="lg" href={IMPORT_WIZARD_URL}>
                  <Trans i18nKey="alerting.settings.import.empty-cta">Import Alertmanager configuration</Trans>
                </LinkButton>
              }
            >
              <Trans i18nKey="alerting.settings.import.empty-body">
                Import an Alertmanager configuration to stage it here as a safe, reversible copy. Review what it
                contains, then promote it into your live Grafana Alertmanager when you&apos;re ready.
              </Trans>{' '}
              <TextLink href={DOCS_URL_ALERTING_MIGRATION} external>
                <Trans i18nKey="alerting.settings.import.empty-learn-more">
                  Learn more about importing configurations
                </Trans>
              </TextLink>
            </EmptyState>
          )}

          {!isLoading && !isError && stagedConfig && <StagedConfiguration stagedConfig={stagedConfig} />}
        </>
      )}
    </Stack>
  );
}

export default withPageErrorBoundary(ImportSettingsPage);
