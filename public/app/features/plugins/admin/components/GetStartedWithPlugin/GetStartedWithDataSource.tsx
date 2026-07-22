import { useCallback } from 'react';
import * as React from 'react';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Icon, Stack } from '@grafana/ui';
import { AssistantSetupDropdown } from 'app/features/connections/components/AssistantSetupDropdown/AssistantSetupDropdown';
import { ROUTES } from 'app/features/connections/constants';
import { addDataSource } from 'app/features/datasources/state/actions';
import { useDispatch } from 'app/types/store';

import { isDataSourceEditor } from '../../permissions';
import { type CatalogPlugin } from '../../types';

type Props = {
  plugin: CatalogPlugin;
};

export function GetStartedWithDataSource({ plugin }: Props): React.ReactElement | null {
  const dispatch = useDispatch();
  const { isAvailable: isAssistantAvailable, openAssistant } = useAssistant();

  const onAddDataSource = useCallback(() => {
    const meta = {
      name: plugin.name,
      id: plugin.id,
    };

    dispatch(addDataSource(meta, ROUTES.DataSourcesEdit));
  }, [dispatch, plugin]);

  const onSetupWithAssistant = useCallback(async () => {
    if (!openAssistant) {
      return;
    }

    openAssistant({
      origin: `grafana/plugin-page/${plugin.id}/add-data-source`,
      mode: 'assistant',
      context: [
        createAssistantContextItem('structured', {
          data: { pluginId: plugin.id, title: t('plugins.get-started-with-data-source.plugin-id', 'Plugin ID') },
        }),
      ],
      prompt: `Help me create a new ${plugin.name} data source.`,
      autoSend: true,
    });
  }, [plugin, openAssistant]);

  if (!isDataSourceEditor()) {
    return null;
  }

  const disabledButton = config.pluginAdminExternalManageEnabled && !plugin.isFullyInstalled;
  const buttonTitle = disabledButton
    ? t(
        'plugins.get-started-with-data-source.title-button-disabled',
        "The plugin isn't usable yet, it may take some time to complete the installation."
      )
    : undefined;

  const addNewDataSourceLabel = (
    <>
      <Icon name="plus" />
      <Trans i18nKey="plugins.get-started-with-data-source.add-new-data-source">Add new data source</Trans>
    </>
  );

  const showAssistantSetup = isAssistantAvailable && !!openAssistant;

  // Without the assistant there's only one action, so skip the dropdown and add the data source directly.
  if (!showAssistantSetup) {
    return (
      <Button variant="primary" disabled={disabledButton} title={buttonTitle} onClick={onAddDataSource}>
        <Stack direction="row" alignItems="center" gap={1}>
          {addNewDataSourceLabel}
        </Stack>
      </Button>
    );
  }

  return (
    <AssistantSetupDropdown
      assistantItem={{
        label: t('plugins.get-started-with-data-source.setup-assistant', 'Set up with assistant'),
        description: t('plugins.get-started-with-data-source.setup-assistant-description', 'Guided configuration'),
        onClick: onSetupWithAssistant,
      }}
      manualItem={{
        label: t('plugins.get-started-with-data-source.setup-manually', 'Set up manually'),
        description: t(
          'plugins.get-started-with-data-source.setup-manually-description',
          'Configure all settings yourself'
        ),
        onClick: onAddDataSource,
      }}
      buttonProps={{ variant: 'primary', disabled: disabledButton, title: buttonTitle }}
    >
      {addNewDataSourceLabel}
    </AssistantSetupDropdown>
  );
}
