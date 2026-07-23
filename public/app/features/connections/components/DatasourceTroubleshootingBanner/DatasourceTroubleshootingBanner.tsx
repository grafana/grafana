import { useEffect, useState } from 'react';

import { createAssistantContextItem, OpenAssistantButton, useAssistant } from '@grafana/assistant';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction, useAppPluginInstalled } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { Alert, LinkButton, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

const userStorage = new UserStorage('advisor-redirect-notice');

export function DatasourceTroubleshootingBanner() {
  const hasAdminRights = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;
  const [showNotice, setShowNotice] = useState(false);
  const { value: isAdvisorInstalled } = useAppPluginInstalled('grafana-advisor-app');
  const { isAvailable: isAssistantAvailable, openAssistant } = useAssistant();

  const canUseAdvisor = hasAdminRights && Boolean(isAdvisorInstalled);
  const canUseAssistant = isAssistantAvailable && Boolean(openAssistant);
  const hasTroubleshootingOptions = canUseAdvisor || canUseAssistant;

  useEffect(() => {
    if (!hasTroubleshootingOptions) {
      return;
    }

    userStorage.getItem('showNotice').then((showNotice) => {
      if (showNotice !== 'false') {
        setShowNotice(true);
      }
    });
  }, [hasTroubleshootingOptions]);

  if (!showNotice) {
    return <></>;
  }

  return (
    <Alert
      severity="info"
      title=""
      onRemove={() => {
        userStorage.setItem('showNotice', 'false');
        setShowNotice(false);
      }}
      action={
        <Stack direction="row" gap={2} alignItems="center">
          {canUseAdvisor && (
            <LinkButton
              aria-label={t('connections.advisor-redirect-notice.aria-label-link-to-advisor', 'Link to Advisor')}
              icon="arrow-right"
              href="/a/grafana-advisor-app"
              variant="secondary"
              fill="solid"
              onClick={() =>
                reportInteraction('connections_datasource_list_advisor_go_to_advisor_clicked', {
                  creator_team: 'grafana_plugins_catalog',
                  schema_version: '1.0.0',
                })
              }
            >
              <Trans i18nKey="connections.advisor-redirect-notice.go-to-advisor">Go to Advisor</Trans>
            </LinkButton>
          )}
          {canUseAssistant && (
            <OpenAssistantButton
              size="md"
              title={t('connections.datasource-troubleshooting-banner.fix-with-assistant', 'Fix with assistant')}
              origin="grafana/datasource-list-page/troubleshoot-datasources"
              prompt="Check the health of my configured data sources and help me fix any issues."
              context={[
                createAssistantContextItem('structured', {
                  data: {
                    title: t(
                      'connections.datasource-troubleshooting-banner.assistant-context',
                      'Troubleshoot data source health'
                    ),
                  },
                }),
              ]}
            />
          )}
        </Stack>
      }
    >
      <Trans i18nKey="connections.datasource-troubleshooting-banner.body">
        Uncover and fix potential issues with your data sources.
      </Trans>
    </Alert>
  );
}
