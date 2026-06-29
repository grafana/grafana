import { t } from '@grafana/i18n';

import { type RepositoryFormData } from '../types';
import { validateNoUserInfoInUrl } from '../utils/validators';

import { type RepoType } from './types';

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
    validate?: (value: string | undefined) => string | true;
  };
}

// Provider-specific field configurations for all providers
// This needs to be a function for translations to work
const getProviderConfigs = (): Record<RepoType, Record<string, FieldConfig>> => {
  // Commit signing fields are identical across all git-based providers.
  const signingFields = {
    signingMethod: {
      label: t('provisioning.shared.signing-method-label', 'Commit signing'),
      description: t(
        'provisioning.shared.signing-method-description',
        'Sign commits so their author can be cryptographically verified.'
      ),
    },
    commitSigningKey: {
      label: t('provisioning.shared.signing-key-label', 'Signing key'),
      description: t('provisioning.shared.signing-key-description', 'Private key used to sign commits. No passphrase.'),
    },
    smimeCertificate: {
      label: t('provisioning.shared.smime-certificate-label', 'S/MIME certificate'),
      description: t(
        'provisioning.shared.smime-certificate-description',
        'X.509 certificate paired with the signing key.'
      ),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: '-----BEGIN CERTIFICATE-----',
    },
    commitSignerName: {
      label: t('provisioning.shared.commit-signer-name-label', 'Signer name'),
      description: t('provisioning.shared.commit-signer-name-description', 'Name of the commit signer.'),
      placeholder: t('provisioning.shared.commit-signer-name-placeholder', 'Grafana'),
    },
    commitSignerEmail: {
      label: t('provisioning.shared.commit-signer-email-label', 'Signer email'),
      description: t('provisioning.shared.commit-signer-email-description', 'Must match the signing key identity.'),
      placeholder: t('provisioning.shared.commit-signer-email-placeholder', 'noreply@grafana.com'),
    },
  };

  // Shared field descriptions used across multiple providers
  const shared = {
    branch: {
      label: t('provisioning.shared.branch-label', 'Branch'),
      description: t('provisioning.shared.branch-description', 'The branch to use for provisioning'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'main',
    },
    path: {
      label: t('provisioning.shared.path-label', 'Path'),
      description: t(
        'provisioning.shared.path-description',
        'Optional. Path to the subdirectory with the resources you want to sync.'
      ),
      placeholder: '',
    },
    url: {
      label: t('provisioning.shared.url-label', 'Repository URL'),
      validation: {
        pattern: {
          value: /^https:\/\/[^\/]+\/[^\/]+\/[^\/]+\/?$/,
          message: t('provisioning.shared.url-pattern', 'Must be a valid repository URL (https://hostname/owner/repo)'),
        },
        validate: validateNoUserInfoInUrl,
      },
    },
    tokenUser: {
      label: t('provisioning.shared.token-user-label', 'Username'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: 'username',
    },
  };

  // GitHub and GitHub Enterprise share the same fields; only the URL placeholder host
  // differs.
  const github = (...hosts: string[]): Record<string, FieldConfig> => ({
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
      ...shared.url,
      description: t('provisioning.github.url-description', 'The GitHub repository URL'),
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder: hosts
        .map((h) => {
          return h + '/owner/repository';
        })
        .join(' or '),
      required: true,
      validation: {
        ...shared.url.validation,
        required: t('provisioning.github.url-required', 'Repository URL is required'),
      },
    },
    branch: {
      ...shared.branch,
      required: true,
      validation: {
        required: t('provisioning.github.branch-required', 'Branch is required'),
      },
    },
    path: {
      ...shared.path,
      required: false,
    },
    prWorkflow: {
      label: t('provisioning.github.pr-workflow-label', 'Enable pull request option when saving'),
      description: t(
        'provisioning.github.pr-workflow-description', // trufflehog:ignore
        'Allows users to choose whether to open a pull request when saving changes. If the repository does not allow direct changes to the main branch, a pull request may still be required.'
      ),
    },
    ...signingFields,
  });

  return {
    github: github('https://github.com'),
    githubEnterprise: github('https://your-ghe-url.com', 'https://<slug>.ghe.com'),
    gitlab: {
      token: {
        label: t('provisioning.gitlab.token-label', 'Project Access Token'),
        description: t(
          'provisioning.gitlab.token-description',
          'GitLab Project Access Token with repository permissions'
        ),
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        placeholder: 'glpat-xxxxxxxxxxxxxxxxxxx',
        required: true,
        validation: {
          required: t('provisioning.gitlab.token-required', 'GitLab token is required'),
        },
      },
      url: {
        ...shared.url,
        description: t('provisioning.gitlab.url-description', 'The GitLab repository URL'),
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        placeholder: 'https://gitlab.com/group/repository',
        required: true,
        validation: {
          required: t('provisioning.gitlab.url-required', 'Repository URL is required'),
          pattern: {
            value: /^https:\/\/[^\/]+\/[^\/]+(\/[^\/]+)+\/?$/,
            message: t(
              'provisioning.gitlab.url-pattern',
              'Must be a valid repository URL (https://hostname/group/repository or https://hostname/group/subgroup/repository)'
            ),
          },
          validate: validateNoUserInfoInUrl,
        },
      },
      branch: {
        ...shared.branch,
        required: true,
        validation: {
          required: t('provisioning.gitlab.branch-required', 'Branch is required'),
        },
      },
      path: {
        ...shared.path,
        required: false,
      },
      prWorkflow: {
        label: t('provisioning.gitlab.pr-workflow-label', 'Enable merge request option when saving'),
        description: t(
          'provisioning.gitlab.pr-workflow-description',
          'Allows users to choose whether to open a merge request when saving changes. If the repository does not allow direct changes to the main branch, a merge request may still be required.'
        ),
      },
      ...signingFields,
    },
    bitbucket: {
      token: {
        label: t('provisioning.bitbucket.token-label', 'API Token'),
        description: t('provisioning.bitbucket.token-description', 'Bitbucket API Token with repository permissions'),
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        placeholder: 'ATATTxxxxxxxxxxxxxxxx',
        required: true,
        validation: {
          required: t('provisioning.bitbucket.token-required', 'Bitbucket token is required'),
        },
      },
      tokenUser: {
        ...shared.tokenUser,
        description: t(
          'provisioning.bitbucket.token-user-description',
          'The username that will be used to access the repository with the API token'
        ),
        required: true,
        validation: {
          required: t('provisioning.bitbucket.token-user-required', 'Username is required'),
        },
      },
      url: {
        ...shared.url,
        description: t('provisioning.bitbucket.url-description', 'The Bitbucket repository URL'),
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        placeholder: 'https://bitbucket.org/owner/repository',
        required: true,
        validation: {
          required: t('provisioning.bitbucket.url-required', 'Repository URL is required'),
          pattern: {
            value: /^https:\/\/[^\/]+\/[^\/]+(\/[^\/]+)+\/?$/,
            message: t(
              'provisioning.bitbucket.url-pattern',
              'Must be a valid repository URL (https://hostname/owner/repo or https://hostname/scm/project/repo)'
            ),
          },
          validate: validateNoUserInfoInUrl,
        },
      },
      branch: {
        ...shared.branch,
        required: true,
        validation: {
          required: t('provisioning.bitbucket.branch-required', 'Branch is required'),
        },
      },
      path: {
        ...shared.path,
        required: false,
      },
      prWorkflow: {
        label: t('provisioning.bitbucket.pr-workflow-label', 'Enable pull request option when saving'),
        description: t(
          'provisioning.bitbucket.pr-workflow-description',
          'Allows users to choose whether to open a pull request when saving changes. If the repository does not allow direct changes to the main branch, a pull request may still be required.'
        ),
      },
      ...signingFields,
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
        ...shared.tokenUser,
        description: t(
          'provisioning.git.token-user-description',
          'The username that will be used to access the repository with the access token'
        ),
        required: false,
      },
      url: {
        ...shared.url,
        description: t(
          'provisioning.git.url-description',
          'The Git repository URL. Most servers require the URL to end with .git (e.g. https://host/owner/repo.git).'
        ),
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        placeholder: 'https://git.example.com/owner/repository.git',
        required: true,
        validation: {
          required: t('provisioning.git.url-required', 'Repository URL is required'),
          pattern: {
            value: /^https?:\/\/.+/,
            message: t('provisioning.git.url-pattern', 'Must be a valid Git repository URL'),
          },
          validate: validateNoUserInfoInUrl,
        },
      },
      branch: {
        ...shared.branch,
        required: true,
        validation: {
          required: t('provisioning.git.branch-required', 'Branch is required'),
        },
      },
      path: {
        ...shared.path,
        required: false,
      },
      prWorkflow: {
        label: t('provisioning.git.pr-workflow-label', 'Enable pull request option when saving'),
        description: t(
          'provisioning.git.pr-workflow-description',
          'Allows users to choose whether to open a pull request when saving changes. If the repository does not allow direct changes to the main branch, a pull request may still be required.'
        ),
      },
      ...signingFields,
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
  };
};

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
      signingMethodConfig?: FieldConfig;
      signingKeyConfig?: FieldConfig;
      smimeCertificateConfig?: FieldConfig;
      commitSignerNameConfig?: FieldConfig;
      commitSignerEmailConfig?: FieldConfig;
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
  const signingMethodConfig = configs.signingMethod; // Optional, only for git-based providers
  const signingKeyConfig = configs.commitSigningKey; // Optional, only for git-based providers
  const smimeCertificateConfig = configs.smimeCertificate; // Paired with commitSigningKey when format is smime
  const commitSignerNameConfig = configs.commitSignerName; // Paired with commitSigningKey
  const commitSignerEmailConfig = configs.commitSignerEmail; // Paired with commitSigningKey
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
    signingMethodConfig,
    signingKeyConfig,
    smimeCertificateConfig,
    commitSignerNameConfig,
    commitSignerEmailConfig,
    urlConfig,
    branchConfig,
    pathConfig,
    prWorkflowConfig,
  };
};

export const getSigningMethodOptions = (): Array<{ label: string; value: RepositoryFormData['signingMethod'] }> => [
  { label: t('provisioning.shared.signing-method-none', 'None'), value: '' },
  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
  { label: 'GPG', value: 'gpg' },
  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
  { label: 'SSH', value: 'ssh' },
  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
  { label: 'S/MIME', value: 'smime' },
];

export const getSigningKeyPlaceholder = (format?: string): string => {
  switch (format) {
    case 'ssh':
      return '-----BEGIN OPENSSH PRIVATE KEY-----';
    case 'smime':
      return '-----BEGIN PRIVATE KEY-----';
    default:
      return '-----BEGIN PGP PRIVATE KEY BLOCK-----';
  }
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
