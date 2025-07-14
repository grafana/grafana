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
const PROVIDER_CONFIGS: Record<RepoType, Record<string, FieldConfig>> = {
  github: {
    token: {
      label: 'Personal Access Token',
      description: 'GitHub Personal Access Token with repository permissions',
      placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      required: true,
      validation: {
        required: 'GitHub token is required',
      },
    },
    url: {
      label: 'Repository URL',
      description: 'The GitHub repository URL',
      placeholder: 'https://github.com/owner/repository',
      required: true,
      validation: {
        required: 'Repository URL is required',
        pattern: {
          value: /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/,
          message: 'Must be a valid GitHub repository URL',
        },
      },
    },
    branch: {
      label: 'Branch',
      description: 'The branch to use for provisioning',
      placeholder: 'main',
      required: true,
      validation: {
        required: 'Branch is required',
      },
    },
    path: {
      label: 'Path',
      description: 'Optional subdirectory path within the repository',
      placeholder: 'grafana/',
      required: false,
    },
  },

  gitlab: {
    token: {
      label: 'Project Access Token',
      description: 'GitLab Project Access Token with repository permissions',
      placeholder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
      required: true,
      validation: {
        required: 'GitLab token is required',
      },
    },
    url: {
      label: 'Repository URL',
      description: 'The GitLab repository URL',
      placeholder: 'https://gitlab.com/owner/repository',
      required: true,
      validation: {
        required: 'Repository URL is required',
        pattern: {
          value: /^https:\/\/gitlab\.com\/[^\/]+\/[^\/]+\/?$/,
          message: 'Must be a valid GitLab repository URL',
        },
      },
    },
    branch: {
      label: 'Branch',
      description: 'The branch to use for provisioning',
      placeholder: 'main',
      required: true,
      validation: {
        required: 'Branch is required',
      },
    },
    path: {
      label: 'Path',
      description: 'Optional subdirectory path within the repository',
      placeholder: 'grafana/',
      required: false,
    },
  },

  bitbucket: {
    token: {
      label: 'App Password',
      description: 'Bitbucket App Password with repository permissions',
      placeholder: 'ATBBxxxxxxxxxxxxxxxx',
      required: true,
      validation: {
        required: 'Bitbucket token is required',
      },
    },
    url: {
      label: 'Repository URL',
      description: 'The Bitbucket repository URL',
      placeholder: 'https://bitbucket.org/owner/repository',
      required: true,
      validation: {
        required: 'Repository URL is required',
        pattern: {
          value: /^https:\/\/bitbucket\.org\/[^\/]+\/[^\/]+\/?$/,
          message: 'Must be a valid Bitbucket repository URL',
        },
      },
    },
    branch: {
      label: 'Branch',
      description: 'The branch to use for provisioning',
      placeholder: 'main',
      required: true,
      validation: {
        required: 'Branch is required',
      },
    },
    path: {
      label: 'Path',
      description: 'Optional subdirectory path within the repository',
      placeholder: 'grafana/',
      required: false,
    },
  },

  git: {
    token: {
      label: 'Access Token',
      description: 'Git repository access token or password',
      placeholder: 'token or password',
      required: true,
      validation: {
        required: 'Git token is required',
      },
    },
    url: {
      label: 'Repository URL',
      description: 'The Git repository URL',
      placeholder: 'https://git.example.com/owner/repository.git',
      required: true,
      validation: {
        required: 'Repository URL is required',
        pattern: {
          value: /^https?:\/\/.+/,
          message: 'Must be a valid Git repository URL',
        },
      },
    },
    branch: {
      label: 'Branch',
      description: 'The branch to use for provisioning',
      placeholder: 'main',
      required: true,
      validation: {
        required: 'Branch is required',
      },
    },
    path: {
      label: 'Path',
      description: 'Optional subdirectory path within the repository',
      placeholder: 'grafana/',
      required: false,
    },
  },

  local: {
    path: {
      label: 'Repository Path',
      description: 'Local file system path to the repository',
      placeholder: '/path/to/repository',
      required: true,
      validation: {
        required: 'Repository path is required',
      },
    },
  },
};

/**
 * Get field configuration for a specific provider and field
 */
const getSingleFieldConfig = (type: RepoType, fieldName: string): FieldConfig | undefined => {
  return PROVIDER_CONFIGS[type]?.[fieldName];
};

/**
 * Get field configurations for multiple fields - returns object with xxxConfig keys
 */
const getMultipleFieldConfigs = (type: RepoType, fieldNames: string[]): Record<string, FieldConfig | undefined> => {
  const result: Record<string, FieldConfig | undefined> = {};

  for (const fieldName of fieldNames) {
    const configKey = `${fieldName}Config`;
    result[configKey] = getSingleFieldConfig(type, fieldName);
  }

  return result;
};

/**
 * Get field configuration(s) for a specific provider
 *
 * Usage:
 * - Single field: getProviderFields(type)('token')
 * - Multiple fields: const {tokenConfig, urlConfig} = getProviderFields(type)(['token', 'url'])
 */
export const getProviderFields = (type: RepoType) => {
  function getFields(fieldName: string): FieldConfig | undefined;
  function getFields(fieldNames: string[]): Record<string, FieldConfig | undefined>;
  function getFields(input: string | string[]): FieldConfig | undefined | Record<string, FieldConfig | undefined> {
    if (Array.isArray(input)) {
      return getMultipleFieldConfigs(type, input);
    } else {
      return getSingleFieldConfig(type, input);
    }
  }

  return getFields;
};
