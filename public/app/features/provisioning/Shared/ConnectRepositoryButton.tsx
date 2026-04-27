import { useNavigate } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { Button, Dropdown, Menu, Stack } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useGetFrontendSettingsQuery, type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { CONNECT_URL, DEFAULT_REPOSITORY_TYPES } from '../constants';
import { checkSyncSettings } from '../utils/checkSyncSettings';
import { isOnPrem } from '../utils/isOnPrem';
import { getOrderedRepositoryConfigs } from '../utils/repositoryTypes';

interface Props {
  items?: Repository[];
}

export function ConnectRepositoryButton({ items }: Props) {
  const navigate = useNavigate();
  const { data: frontendSettings } = useGetFrontendSettingsQuery();
  const state = checkSyncSettings(items, frontendSettings?.maxRepositories);

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
                onClick={() => {
                  navigate(`${CONNECT_URL}/${config.type}`);
                }}
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
    return isOnPrem()
      ? t(
          'provisioning.connect-repository-button.max-repos-reached-tooltip-onprem',
          'Your instance has reached the maximum number of connected repositories. You can increase the limit in your Grafana configuration.'
        )
      : t(
          'provisioning.connect-repository-button.max-repos-reached-tooltip',
          'Your account has reached the maximum number of connected repositories'
        );
  }

  return '';
}
