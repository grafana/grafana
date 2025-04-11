import { useNavigate } from 'react-router-dom-v5-compat';

import { Alert, Button, Dropdown, Icon, LinkButton, Menu, Stack } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';
import { Trans, t } from 'app/core/internationalization';

import { RepoType } from '../Wizard/types';
import { CONNECT_URL } from '../constants';
import { checkSyncSettings } from '../utils/checkSyncSettings';

interface Props {
  items?: Repository[];
  showDropdown?: boolean;
}

type ConnectUrl = `${typeof CONNECT_URL}/${RepoType}`;

const gitURL: ConnectUrl = `${CONNECT_URL}/github`;
const localURL: ConnectUrl = `${CONNECT_URL}/local`;

export function ConnectRepositoryButton({ items, showDropdown = false }: Props) {
  const state = checkSyncSettings(items);
  const navigate = useNavigate();

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

  if (showDropdown) {
    return (
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item
              icon="code-branch"
              label={t('provisioning.connect-repository-button.configure-git-sync', 'Configure Git Sync')}
              onClick={() => {
                navigate(gitURL);
              }}
            />
            <Menu.Item
              icon="file-alt"
              label={t('provisioning.connect-repository-button.configure-file', 'Configure file provisioning')}
              onClick={() => {
                navigate(localURL);
              }}
            />
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
