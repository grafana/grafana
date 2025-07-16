import { t } from '@grafana/i18n';
import { IconName } from '@grafana/ui';

import { RepoType } from '../Wizard/types';

export interface RepositoryTypeConfig {
  type: RepoType;
  label: string;
  description: string;
  icon: IconName;
}

export const getRepositoryTypeConfigs = (): RepositoryTypeConfig[] => [
  {
    type: 'git',
    label: t('provisioning.repository-types.pure-git', 'Pure Git'),
    description: t('provisioning.repository-types.pure-git-description', 'Connect to any Git repository'),
    icon: 'code-branch' as const,
  },
  {
    type: 'github',
    label: t('provisioning.repository-types.github', 'GitHub'),
    description: t('provisioning.repository-types.github-description', 'Connect to GitHub repositories'),
    icon: 'github' as const,
  },
  {
    type: 'gitlab',
    label: t('provisioning.repository-types.gitlab', 'GitLab'),
    description: t('provisioning.repository-types.gitlab-description', 'Connect to GitLab repositories'),
    icon: 'gitlab' as const,
  },
  {
    type: 'bitbucket',
    label: t('provisioning.repository-types.bitbucket', 'Bitbucket'),
    description: t('provisioning.repository-types.bitbucket-description', 'Connect to Bitbucket repositories'),
    icon: 'cloud' as const,
  },
  {
    type: 'local',
    label: t('provisioning.repository-types.local', 'Local'),
    description: t('provisioning.repository-types.local-description', 'Configure file provisioning'),
    icon: 'file-alt' as const,
  },
];

export const getRepositoryTypeConfig = (type: RepoType): RepositoryTypeConfig | undefined => {
  return getRepositoryTypeConfigs().find((config) => config.type === type);
};
