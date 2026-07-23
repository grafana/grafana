import { type JSX } from 'react';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { Pages } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Icon, LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AssistantSetupDropdown } from 'app/features/connections/components/AssistantSetupDropdown/AssistantSetupDropdown';
import { ROUTES } from 'app/features/connections/constants';
import { AccessControlAction } from 'app/types/accessControl';

export function DataSourceAddButton(): JSX.Element | null {
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const { isAvailable: isAssistantAvailable, openAssistant } = useAssistant();

  if (!canCreateDataSource) {
    return null;
  }

  const onAddDataSource = () => {
    reportInteraction('connections_datasource_list_add_datasource_clicked', {}, { silent: true });
    locationService.push(ROUTES.DataSourcesNew);
  };

  const onSetupWithAssistant = () => {
    if (!openAssistant) {
      return;
    }

    openAssistant({
      origin: 'grafana/datasources-list/add-data-source',
      mode: 'assistant',
      context: [
        createAssistantContextItem('structured', {
          data: { title: t('data-sources.datasource-add-button.assistant-context', 'Add a new data source') },
        }),
      ],
      prompt: 'Help me set up a new data source.',
      autoSend: true,
    });
  };

  const addNewDataSourceLabel = (
    <>
      <Icon name="plus" />
      <Trans i18nKey="data-sources.datasource-add-button.label">Add new data source</Trans>
    </>
  );

  const showAssistantSetup = isAssistantAvailable && !!openAssistant;

  // Without the assistant there's only one action, so keep the plain link button.
  if (!showAssistantSetup) {
    return (
      <LinkButton
        icon="plus"
        href={config.appSubUrl + ROUTES.DataSourcesNew}
        data-testid={Pages.DataSources.dataSourceAddButton}
        onClick={() => reportInteraction('connections_datasource_list_add_datasource_clicked', {}, { silent: true })}
      >
        <Trans i18nKey="data-sources.datasource-add-button.label">Add new data source</Trans>
      </LinkButton>
    );
  }

  return (
    <AssistantSetupDropdown
      assistantItem={{
        label: t('data-sources.datasource-add-button.setup-assistant', 'Set up with assistant'),
        description: t('data-sources.datasource-add-button.setup-assistant-description', 'Guided configuration'),
        onClick: onSetupWithAssistant,
      }}
      manualItem={{
        label: t('data-sources.datasource-add-button.setup-manually', 'Set up manually'),
        description: t(
          'data-sources.datasource-add-button.setup-manually-description',
          'Configure all settings yourself'
        ),
        onClick: onAddDataSource,
      }}
      buttonProps={{ variant: 'primary' }}
    >
      {addNewDataSourceLabel}
    </AssistantSetupDropdown>
  );
}
