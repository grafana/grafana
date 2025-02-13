import { LinkButton, Stack, Text } from '@grafana/ui';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { WithReturnButton } from './components/WithReturnButton';
import { useEditConfigurationDrawer } from './components/settings/ConfigurationDrawer';
import { ExternalAlertmanagers } from './components/settings/ExternalAlertmanagers';
import InternalAlertmanager from './components/settings/InternalAlertmanager';
import { SettingsProvider, useSettings } from './components/settings/SettingsContext';
import { withPageErrorBoundary } from './withPageErrorBoundary';

function SettingsPage() {
  return (
    <SettingsProvider>
      <SettingsContent />
    </SettingsProvider>
  );
}

function SettingsContent() {
  const [configurationDrawer, showConfiguration] = useEditConfigurationDrawer();
  const { isLoading } = useSettings();

  return (
    <AlertingPageWrapper
      navId="alerting-admin"
      isLoading={isLoading}
      actions={[
        <WithReturnButton
          key="add-alertmanager"
          title="Alerting settings"
          component={
            <LinkButton href="/connections/datasources/alertmanager" icon="plus" variant="primary">
              Add new Alertmanager
            </LinkButton>
          }
        />,
      ]}
    >
      <Stack direction="column" gap={2}>
        {/* Grafana built-in Alertmanager */}
        <Text variant="h5">Built-in Alertmanager</Text>
        <InternalAlertmanager onEditConfiguration={showConfiguration} />
        {/* other (external Alertmanager data sources we have added to Grafana such as vanilla, Mimir, Cortex) */}
        <Text variant="h5">Other Alertmanagers</Text>
        <ExternalAlertmanagers onEditConfiguration={showConfiguration} />
      </Stack>
      {configurationDrawer}
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(SettingsPage);
