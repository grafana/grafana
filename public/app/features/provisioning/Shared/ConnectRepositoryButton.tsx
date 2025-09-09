import { useNavigate } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { Button, Dropdown, Icon, Menu, Stack } from '@grafana/ui';
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

  const isButtonDisabled = state.instanceConnected || state.maxReposReached;

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
      <Button
        variant="primary"
        disabled={isButtonDisabled}
        tooltip={getConfigureRepoTooltip({
          instanceConnected: state.instanceConnected,
          maxReposReached: state.maxReposReached,
          count: state.repoCount,
        })}
      >
        <Stack alignItems="center">
          <Trans i18nKey="provisioning.connect-repository-button.configure">Configure</Trans>
          <Icon name={'angle-down'} />
        </Stack>
      </Button>
    </Dropdown>
  );
}

export function getConfigureRepoTooltip({
  instanceConnected,
  maxReposReached,
  count,
}: {
  instanceConnected: boolean;
  maxReposReached: boolean;
  count: number;
}) {
  if (instanceConnected) {
    return t(
      'provisioning.connect-repository-button.instance-fully-managed-tooltip',
      'Configuration is disabled because this instance is fully managed'
    );
  }

  if (maxReposReached) {
    return t(
      'provisioning.connect-repository-button.repository-limit-reached-tooltip',
      'Repository limit reached {{count}}',
      {
        count,
      }
    );
  }

  return '';
}
