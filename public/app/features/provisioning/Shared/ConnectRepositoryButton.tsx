import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Dropdown, Icon, LinkButton, Menu, Stack } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1/endpoints.gen';

import { RepoType } from '../Wizard/types';
import { CONNECT_URL } from '../constants';
import { checkSyncSettings } from '../utils/checkSyncSettings';
import { getRepositoryTypeConfig } from '../utils/repositoryTypes';

interface Props {
  items?: Repository[];
  showDropdown?: boolean;
}

type ConnectUrl = `${typeof CONNECT_URL}/${RepoType}`;

export function ConnectRepositoryButton({ items, showDropdown = false }: Props) {
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
          defaults={'Repository limit reached ({{count}})'}
        />
      </Alert>
    );
  }

  const availableTypes = frontendSettings?.availableRepositoryTypes || ['github', 'local'];

  if (showDropdown) {
    return (
      <Dropdown
        overlay={
          <Menu>
            {availableTypes.map((type) => {
              const config = getRepositoryTypeConfig(type);
              const icon = config?.icon || (type === 'local' ? 'file-alt' : 'code-branch');
              const label = config
                ? t(`provisioning.repository-types.configure-with-${type}`, `Configure with ${config.label}`)
                : t(
                    `provisioning.connect-repository-button.configure-with-${type}`,
                    `Configure with ${type.charAt(0).toUpperCase() + type.slice(1)}`
                  );

              return (
                <Menu.Item key={type} icon={icon} label={label} onClick={() => navigate(`${CONNECT_URL}/${type}`)} />
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

  // Default buttons variant (legacy behavior)
  const gitURL: ConnectUrl = `${CONNECT_URL}/github`;
  const localURL: ConnectUrl = `${CONNECT_URL}/local`;

  return (
    <Stack gap={3}>
      <LinkButton href={gitURL} variant="primary">
        <Trans i18nKey="provisioning.connect-repository-button.configure-git-sync">Configure Git Sync</Trans>
      </LinkButton>
      <LinkButton href={localURL} variant="secondary">
        <Trans i18nKey="provisioning.connect-repository-button.configure-file">Configure file provisioning</Trans>
      </LinkButton>
    </Stack>
  );
}
