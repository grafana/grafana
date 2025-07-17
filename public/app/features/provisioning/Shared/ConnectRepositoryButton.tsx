import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Dropdown, Icon, Menu, Stack } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1/endpoints.gen';

import { CONNECT_URL } from '../constants';
import { checkSyncSettings } from '../utils/checkSyncSettings';
import { getRepositoryTypeConfig } from '../utils/repositoryTypes';

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

  const availableTypes = frontendSettings?.availableRepositoryTypes || ['github', 'local'];

  return (
    <Dropdown
      overlay={
        <Menu>
          {availableTypes.map((type) => {
            const config = getRepositoryTypeConfig(type);
            if (!config) {
              return null; // Skip types without configuration
            }
            const label = t('provisioning.repository-types.configure-with-provider', 'Configure with {{provider}}', {
              provider: config.label,
            });
            return (
              <Menu.Item
                key={type}
                icon={config.icon}
                label={label}
                onClick={() => navigate(`${CONNECT_URL}/${type}`)}
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
