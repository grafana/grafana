import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, useTranslate } from '@grafana/i18n';
import { Alert, Button, Dropdown, Icon, LinkButton, Menu, Stack } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';

import { RepoType } from '../Wizard/types';
import { CONNECT_URL } from '../constants';
import { checkSyncSettings } from '../utils/checkSyncSettings';

interface Props {
  items?: Repository[];
  showDropdown?: boolean;
}

type ConnectUrl = `${typeof CONNECT_URL}/${RepoType}`;

const githubURL: ConnectUrl = `${CONNECT_URL}/github`;
const localURL: ConnectUrl = `${CONNECT_URL}/local`;
const gitURL: ConnectUrl = `${CONNECT_URL}/git`;

export function ConnectRepositoryButton({ items }: Props) {
  const state = checkSyncSettings(items);
  const navigate = useNavigate();
  const { t } = useTranslate();

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

    return (
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item
              icon="github"
              label={t('provisioning.connect-repository-button.configure-git-sync', 'Configure Github Sync')}
              onClick={() => {
                navigate(githubURL);
              }}
            />
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
