import { t } from '@grafana/i18n';
import { IconName } from '@grafana/ui';

import { RepoType } from '../Wizard/types';
import bitbucketSvg from '../img/bitbucket.svg';
import gitSvg from '../img/git.svg';
import gitlabSvg from '../img/gitlab.svg';

export interface RepositoryTypeConfig {
  type: RepoType;
  label: string;
  description: string;
  icon: IconName;
  logo?: string;
}

export const getRepositoryTypeConfigs = (): RepositoryTypeConfig[] => [
  {
    type: 'git',
    label: t('provisioning.repository-types.pure-git', 'Pure Git'),
    description: t('provisioning.repository-types.pure-git-description', 'Connect to any Git repository'),
    icon: 'git' as const,
    logo: gitSvg,
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
    logo: gitlabSvg,
  },
  {
    type: 'bitbucket',
    label: t('provisioning.repository-types.bitbucket', 'Bitbucket'),
    description: t('provisioning.repository-types.bitbucket-description', 'Connect to Bitbucket repositories'),
    icon: 'bitbucket' as const,
    logo: bitbucketSvg,
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

const GIT_PROVIDER_TYPES = ['github', 'gitlab', 'bitbucket', 'git'];

export const isGitProvider = (type: RepoType) => {
  return GIT_PROVIDER_TYPES.includes(type);
};

/**
 * Get repository configurations ordered by provider type priority:
 * 1. Git providers first (github, gitlab, bitbucket) - excludes pure git
 * 2. Other providers (pure git, local)
 */
export const getOrderedRepositoryConfigs = (availableTypes: RepoType[]) => {
  const repositoryConfigs = getRepositoryTypeConfigs().filter((config) => availableTypes.includes(config.type));

  // Separate git providers from other providers
  const gitProviders = repositoryConfigs.filter((config) => isGitProvider(config.type) && config.type !== 'git');
  const otherProviders = repositoryConfigs.filter((config) => !isGitProvider(config.type) || config.type === 'git');

  return {
    gitProviders,
    otherProviders,
    orderedConfigs: [...gitProviders, ...otherProviders],
  };
};
