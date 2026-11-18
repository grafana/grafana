import { type JSX, useState } from 'react';

import { useAssistant } from '@grafana/assistant';
import { Pages } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Dropdown, Icon, LinkButton, Menu, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { ROUTES } from 'app/features/connections/constants';
import { AccessControlAction } from 'app/types/accessControl';

export function DataSourceAddButton(): JSX.Element | null {
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const { isAvailable: isAssistantAvailable, openAssistant } = useAssistant();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!canCreateDataSource) {
    return null;
  }

  const onAddDataSource = () => {
    reportInteraction('assistant_setup_dropdown_option_selected', { source: 'datasources_list', option: 'manual' });
    reportInteraction('connections_datasource_list_add_datasource_clicked', {}, { silent: true });
  };

  const onSetupWithAssistant = () => {
    reportInteraction('assistant_setup_dropdown_option_selected', { source: 'datasources_list', option: 'assistant' });

    if (!openAssistant) {
      return;
    }

    openAssistant({
      origin: 'grafana/datasources-list/add-data-source',
      mode: 'assistant',
      prompt: 'I want to connect Grafana to ',
      autoSend: false,
    });
  };

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

  const menu = (
    <Menu>
      <Menu.Item
        icon="ai-sparkle"
        label={t('data-sources.datasource-add-button.setup-assistant', 'Set up with assistant')}
        description={t('data-sources.datasource-add-button.setup-assistant-description', 'Guided configuration')}
        onClick={onSetupWithAssistant}
      />
      <Menu.Item
        icon="list-ul"
        label={t('data-sources.datasource-add-button.setup-manually', 'Set up manually')}
        description={t(
          'data-sources.datasource-add-button.setup-manually-description',
          'Configure all settings yourself'
        )}
        url={config.appSubUrl + ROUTES.DataSourcesNew}
        onClick={onAddDataSource}
      />
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottom-end" onVisibleChange={setIsMenuOpen}>
      <Button variant="primary" data-testid={Pages.DataSources.dataSourceAddButton}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name="plus" />
          <Trans i18nKey="data-sources.datasource-add-button.label">Add new data source</Trans>
          <Icon name={isMenuOpen ? 'angle-up' : 'angle-down'} />
        </Stack>
      </Button>
    </Dropdown>
  );
}
