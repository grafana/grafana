import { t } from '@grafana/i18n';

import { RepoType } from './types';

export interface FieldConfig {
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  validation?: {
    required?: string | boolean;
    pattern?: {
      value: RegExp;
      message: string;
    };
  };
}

// Provider-specific field configurations for all providers
// This needs to be a function for translations to work
const getProviderConfigs = (): Record<RepoType, Record<string, FieldConfig>> => ({
  github: {
    token: {
      label: t('provisioning.github.token-label', 'Personal Access Token'),
      description: t(
        'provisioning.github.token-description',
        'GitHub Personal Access Token with repository permissions'
      ),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      required: true,
      validation: {
        required: t('provisioning.github.token-required', 'GitHub token is required'),
      },
    },
    url: {
      label: t('provisioning.github.url-label', 'Repository URL'),
      description: t('provisioning.github.url-description', 'The GitHub repository URL'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'https://github.com/owner/repository',
      required: true,
      validation: {
        required: t('provisioning.github.url-required', 'Repository URL is required'),
        pattern: {
          value: /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/,
          message: t('provisioning.github.url-pattern', 'Must be a valid GitHub repository URL'),
        },
      },
    },
    branch: {
      label: t('provisioning.github.branch-label', 'Branch'),
      description: t('provisioning.github.branch-description', 'The branch to use for provisioning'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'main',
      required: true,
      validation: {
        required: t('provisioning.github.branch-required', 'Branch is required'),
      },
    },
    path: {
      label: t('provisioning.github.path-label', 'Path'),
      description: t('provisioning.github.path-description', 'Optional subdirectory path within the repository'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'grafana/',
      required: false,
    },
    prWorkflow: {
      label: t('provisioning.github.pr-workflow-label', 'Enable pull request option when saving'),
      description: t(
        'provisioning.github.pr-workflow-description',
        'Allows users to choose whether to open a pull request when saving changes. If the repository does not allow direct changes to the main branch, a pull request may still be required.'
      ),
    },
  },
  gitlab: {
    token: {
      label: t('provisioning.gitlab.token-label', 'Project Access Token'),
      description: t(
        'provisioning.gitlab.token-description',
        'GitLab Project Access Token with repository permissions'
      ),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
      required: true,
      validation: {
        required: t('provisioning.gitlab.token-required', 'GitLab token is required'),
      },
    },
    url: {
      label: t('provisioning.gitlab.url-label', 'Repository URL'),
      description: t('provisioning.gitlab.url-description', 'The GitLab repository URL'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'https://gitlab.com/owner/repository',
      required: true,
      validation: {
        required: t('provisioning.gitlab.url-required', 'Repository URL is required'),
        pattern: {
          value: /^https:\/\/gitlab\.com\/[^\/]+\/[^\/]+\/?$/,
          message: t('provisioning.gitlab.url-pattern', 'Must be a valid GitLab repository URL'),
        },
      },
    },
    branch: {
      label: t('provisioning.gitlab.branch-label', 'Branch'),
      description: t('provisioning.gitlab.branch-description', 'The branch to use for provisioning'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'main',
      required: true,
      validation: {
        required: t('provisioning.gitlab.branch-required', 'Branch is required'),
      },
    },
    path: {
      label: t('provisioning.gitlab.path-label', 'Path'),
      description: t('provisioning.gitlab.path-description', 'Optional subdirectory path within the repository'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'grafana/',
      required: false,
    },
    prWorkflow: {
      label: t('provisioning.gitlab.pr-workflow-label', 'Enable merge request option when saving'),
      description: t(
        'provisioning.gitlab.pr-workflow-description',
        'Allows users to choose whether to open a merge request when saving changes. If the repository does not allow direct changes to the main branch, a merge request may still be required.'
      ),
    },
  },
  bitbucket: {
    token: {
      label: t('provisioning.bitbucket.token-label', 'App Password'),
      description: t('provisioning.bitbucket.token-description', 'Bitbucket App Password with repository permissions'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'ATBBxxxxxxxxxxxxxxxx',
      required: true,
      validation: {
        required: t('provisioning.bitbucket.token-required', 'Bitbucket token is required'),
      },
    },
    tokenUser: {
      label: t('provisioning.bitbucket.token-user-label', 'Username'),
      description: t(
        'provisioning.bitbucket.token-user-description',
        'The username that will be used to access the repository with the app password'
      ),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'username',
      required: true,
      validation: {
        required: t('provisioning.bitbucket.token-user-required', 'Username is required'),
      },
    },
    url: {
      label: t('provisioning.bitbucket.url-label', 'Repository URL'),
      description: t('provisioning.bitbucket.url-description', 'The Bitbucket repository URL'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'https://bitbucket.org/owner/repository',
      required: true,
      validation: {
        required: t('provisioning.bitbucket.url-required', 'Repository URL is required'),
        pattern: {
          value: /^https:\/\/bitbucket\.org\/[^\/]+\/[^\/]+\/?$/,
          message: t('provisioning.bitbucket.url-pattern', 'Must be a valid Bitbucket repository URL'),
        },
      },
    },
    branch: {
      label: t('provisioning.bitbucket.branch-label', 'Branch'),
      description: t('provisioning.bitbucket.branch-description', 'The branch to use for provisioning'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'main',
      required: true,
      validation: {
        required: t('provisioning.bitbucket.branch-required', 'Branch is required'),
      },
    },
    path: {
      label: t('provisioning.bitbucket.path-label', 'Path'),
      description: t('provisioning.bitbucket.path-description', 'Optional subdirectory path within the repository'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'grafana/',
      required: false,
    },
    prWorkflow: {
      label: t('provisioning.bitbucket.pr-workflow-label', 'Enable pull request option when saving'),
      description: t(
        'provisioning.bitbucket.pr-workflow-description',
        'Allows users to choose whether to open a pull request when saving changes. If the repository does not allow direct changes to the main branch, a pull request may still be required.'
      ),
    },
  },
  git: {
    token: {
      label: t('provisioning.git.token-label', 'Access Token'),
      description: t('provisioning.git.token-description', 'Git repository access token or password'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'token or password',
      required: true,
      validation: {
        required: t('provisioning.git.token-required', 'Git token is required'),
      },
    },
    tokenUser: {
      label: t('provisioning.git.token-user-label', 'Username'),
      description: t(
        'provisioning.git.token-user-description',
        'The username that will be used to access the repository with the access token'
      ),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'username',
      required: true,
      validation: {
        required: t('provisioning.git.token-user-required', 'Username is required'),
      },
    },
    url: {
      label: t('provisioning.git.url-label', 'Repository URL'),
      description: t('provisioning.git.url-description', 'The Git repository URL'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'https://git.example.com/owner/repository.git',
      required: true,
      validation: {
        required: t('provisioning.git.url-required', 'Repository URL is required'),
        pattern: {
          value: /^https?:\/\/.+/,
          message: t('provisioning.git.url-pattern', 'Must be a valid Git repository URL'),
        },
      },
    },
    branch: {
      label: t('provisioning.git.branch-label', 'Branch'),
      description: t('provisioning.git.branch-description', 'The branch to use for provisioning'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'main',
      required: true,
      validation: {
        required: t('provisioning.git.branch-required', 'Branch is required'),
      },
    },
    path: {
      label: t('provisioning.git.path-label', 'Path'),
      description: t('provisioning.git.path-description', 'Optional subdirectory path within the repository'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'grafana/',
      required: false,
    },
    prWorkflow: {
      label: t('provisioning.git.pr-workflow-label', 'Enable pull request option when saving'),
      description: t(
        'provisioning.git.pr-workflow-description',
        'Allows users to choose whether to open a pull request when saving changes. If the repository does not allow direct changes to the main branch, a pull request may still be required.'
      ),
    },
  },
  local: {
    path: {
      label: t('provisioning.local.path-label', 'Repository Path'),
      description: t('provisioning.local.path-description', 'Local file system path to the repository'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: '/path/to/repository',
      required: true,
      validation: {
        required: t('provisioning.local.path-required', 'Repository path is required'),
      },
    },
  },
});

/**
 * Get git provider field configurations that are guaranteed to exist
 * This should only be called for git-based providers
 */
export const getGitProviderFields = (
  type: RepoType
):
  | {
      tokenConfig: FieldConfig;
      tokenUserConfig?: FieldConfig;
      urlConfig: FieldConfig;
      branchConfig: FieldConfig;
      pathConfig: FieldConfig;
      prWorkflowConfig: FieldConfig;
    }
  | undefined => {
  const configs = getProviderConfigs()[type];
  if (!configs) {
    throw new Error(`No configuration found for repository type: ${type}`);
  }

  // For git providers, these fields are guaranteed to exist
  const tokenConfig = configs.token;
  const tokenUserConfig = configs.tokenUser; // Optional field, only for some providers
  const urlConfig = configs.url;
  const branchConfig = configs.branch;
  const pathConfig = configs.path;
  const prWorkflowConfig = configs.prWorkflow;

  if (!tokenConfig || !urlConfig || !branchConfig || !pathConfig || !prWorkflowConfig) {
    throw new Error(`Missing required field configurations for ${type}`);
  }

  return {
    tokenConfig,
    tokenUserConfig,
    urlConfig,
    branchConfig,
    pathConfig,
    prWorkflowConfig,
  };
};

/**
 * Get local provider field configurations that are guaranteed to exist
 * This should only be called for local providers
 */
export const getLocalProviderFields = (
  type: RepoType
):
  | {
      pathConfig: FieldConfig;
    }
  | undefined => {
  const configs = getProviderConfigs()[type];
  if (!configs) {
    throw new Error(`No configuration found for repository type: ${type}`);
  }

  // For local providers, the path field is guaranteed to exist
  const pathConfig = configs.path;

  if (!pathConfig) {
    throw new Error(`Missing required field configuration for ${type}: path`);
  }

  return {
    pathConfig,
  };
};
