import { useNavigate } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { Button, Dropdown, Icon, Menu, Stack } from '@grafana/ui';
import { useGetFrontendSettingsQuery, Repository } from 'app/api/clients/provisioning/v0alpha1';

import { CONNECT_URL, DEFAULT_REPOSITORY_TYPES } from '../constants';
import { checkSyncSettings } from '../utils/checkSyncSettings';
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
  const { orderedConfigs: repoTypes } = getOrderedRepositoryConfigs(availableTypes);

  return (
    <Dropdown
      overlay={
        <Menu>
          {repoTypes.map((repoType) => {
            return (
              <Menu.Item
                key={repoType.type}
                icon={repoType.icon}
                label={repoType.label}
                onClick={() => {
                  navigate(`${CONNECT_URL}/${repoType.type}`);
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
        tooltip={getConnectRepoTooltip({
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

export function getConnectRepoTooltip({
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
      'provisioning.connect-repository-button.max-repos-reached-tooltip',
      'Your account has reached the maximum number of connected repositories'
    );
  }

  return '';
}
