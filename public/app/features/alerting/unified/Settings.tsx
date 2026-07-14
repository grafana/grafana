import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { LinkButton, Stack, Text } from '@grafana/ui';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { WithReturnButton } from './components/WithReturnButton';
import { AutoSyncConfiguration } from './components/settings/AutoSyncConfiguration';
import { useEditConfigurationDrawer } from './components/settings/ConfigurationDrawer';
import { ExternalAlertmanagers } from './components/settings/ExternalAlertmanagers';
import InternalAlertmanager from './components/settings/InternalAlertmanager';
import { SettingsProvider, useSettings } from './components/settings/SettingsContext';
import { useSettingsPageNav } from './settings/navigation';
import { withPageErrorBoundary } from './withPageErrorBoundary';

function AlertmanagerSettingsPage() {
  return (
    <SettingsProvider>
      <AlertmanagerSettingsContent />
    </SettingsProvider>
  );
}

function AlertmanagerSettingsContent() {
  const [configurationDrawer, showConfiguration] = useEditConfigurationDrawer();
  const { isLoading } = useSettings();
  const isAutoSyncEnabled = config.featureToggles['alerting.syncExternalAlertmanager'];

  const { navId, pageNav } = useSettingsPageNav();

  return (
    <AlertingPageWrapper
      navId={navId}
      isLoading={isLoading}
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
      <Stack direction="column" gap={2}>
        {isAutoSyncEnabled && <AutoSyncConfiguration />}
        {/* Grafana built-in Alertmanager */}
        <Text variant="h5">
          <Trans i18nKey="alerting.settings-content.builtin-alertmanager">Built-in Alertmanager</Trans>
        </Text>
        <InternalAlertmanager onEditConfiguration={showConfiguration} />
        {/* other (external Alertmanager data sources we have added to Grafana such as vanilla, Mimir, Cortex) */}
        <Text variant="h5">
          <Trans i18nKey="alerting.settings-content.other-alertmanagers">Other Alertmanagers</Trans>
        </Text>
        <ExternalAlertmanagers onEditConfiguration={showConfiguration} />
      </Stack>
      {configurationDrawer}
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(AlertmanagerSettingsPage);
