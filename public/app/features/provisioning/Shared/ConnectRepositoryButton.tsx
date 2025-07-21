import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans } from '@grafana/i18n';
import { Alert, Button, Dropdown, Icon, Menu, Stack } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1/endpoints.gen';

import { CONNECT_URL, DEFAULT_REPOSITORY_TYPES } from '../constants';
import { checkSyncSettings } from '../utils/checkSyncSettings';
import { getOrderedRepositoryConfigs } from '../utils/repositoryTypes';

interface Props {
  items?: Repository[];
}

export function ConnectRepositoryButton({ items }: Props) {
  const state = checkSyncSettings(items);
  const navigate = useNavigate();
  const { data: frontendSettings } = useGetFrontendSettingsQuery();

  if (state.instanceConnected) {
    return null;
  }

  if (state.maxReposReached) {
    return (
      <Alert title="" severity="info">
        <Trans
          i18nKey="provisioning.connect-repository-button.repository-limit-info-alert"
          values={{ count: state.repoCount }}
        >
          Repository limit reached ({'{{count}}'})
        </Trans>
      </Alert>
    );
  }

  const availableTypes = frontendSettings?.availableRepositoryTypes || DEFAULT_REPOSITORY_TYPES;
  const { orderedConfigs } = getOrderedRepositoryConfigs(availableTypes);

  return (
    <Dropdown
      overlay={
        <Menu>
          {orderedConfigs.map((config) => {
            return (
              <Menu.Item
                key={config.type}
                icon={config.icon}
                label={config.label}
                onClick={() => navigate(`${CONNECT_URL}/${config.type}`)}
              />
            );
          })}
        </Menu>
      }
    >
      <Button variant="primary">
        <Stack alignItems="center">
          <Trans i18nKey="provisioning.connect-repository-button.configure">Configure</Trans>
          <Icon name={'angle-down'} />
        </Stack>
      </Button>
    </Dropdown>
  );
}
