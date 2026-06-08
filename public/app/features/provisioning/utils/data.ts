import { type BranchOptions, type CommitOptions, type RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { type RepositoryFormData } from '../types';

const buildCommitOptions = (data: RepositoryFormData): CommitOptions | undefined => {
  const singleResourceMessageTemplate = data.commit?.singleResourceMessageTemplate?.trim();
  const enforceTemplate = data.commit?.enforceTemplate;
  const authorName = data.commit?.authorName?.trim();
  const authorEmail = data.commit?.authorEmail?.trim();
  const signingFormat = data.signingFormat && data.signingFormat !== 'none' ? data.signingFormat : undefined;

  if (!singleResourceMessageTemplate && !enforceTemplate && !authorName && !authorEmail) {
    return undefined;
  }

  const commit: CommitOptions = {};
  if (singleResourceMessageTemplate) {
    commit.singleResourceMessageTemplate = singleResourceMessageTemplate;
  }
  if (enforceTemplate) {
    commit.enforceTemplate = enforceTemplate;
  }
  if (authorName) {
    commit.authorName = authorName;
  }
  if (authorEmail) {
    commit.authorEmail = authorEmail;
  }
  if (signingFormat && (authorName || authorEmail)) {
    commit.signingFormat = signingFormat;
  }
  return commit;
};

const buildBranchOptions = (data: RepositoryFormData): BranchOptions | undefined => {
  const nameTemplate = data.branchOptions?.nameTemplate?.trim();
  const enforceTemplate = data.branchOptions?.enforceTemplate;

  if (!nameTemplate && !enforceTemplate) {
    return undefined;
  }

  const branch: BranchOptions = {};
  if (nameTemplate) {
    branch.nameTemplate = nameTemplate;
  }
  if (enforceTemplate) {
    branch.enforceTemplate = enforceTemplate;
  }
  return branch;
};

export const getWorkflows = (data: RepositoryFormData): RepositorySpec['workflows'] => {
  if (data.readOnly) {
    return [];
  }
  const workflows: RepositorySpec['workflows'] = data.enablePushToConfiguredBranch ? ['write'] : [];

  if (!data.prWorkflow) {
    return workflows;
  }

  return [...workflows, 'branch'];
};

export const dataToSpec = (data: RepositoryFormData, connectionName?: string): RepositorySpec => {
  const spec: RepositorySpec = {
    type: data.type,
    sync: data.sync,
    title: data.title || '',
    workflows: getWorkflows(data),
  };

  const commit = buildCommitOptions(data);
  if (commit) {
    spec.commit = commit;
  }

  const branch = buildBranchOptions(data);
  if (branch) {
    spec.branch = branch;
  }

  if (data.webhook?.baseUrl) {
    spec.webhook = { baseUrl: data.webhook.baseUrl };
  }

  const baseConfig = {
    url: data.url || '',
    branch: data.branch || '',
    path: data.path,
  };

  switch (data.type) {
    case 'github':
      spec.github = {
        ...baseConfig,
        generateDashboardPreviews: data.generateDashboardPreviews,
      };
      // Add connection reference at spec level if using GitHub App
      // connection name is only available for the app flow
      // Prefer data.connectionName over the parameter for consistency
      const finalConnectionName = data.connectionName || connectionName;
      if (finalConnectionName) {
        spec.connection = { name: finalConnectionName };
      }
      break;
    case 'gitlab':
      spec.gitlab = baseConfig;
      break;
    case 'bitbucket':
      spec.bitbucket = {
        ...baseConfig,
        tokenUser: data.tokenUser,
      };
      break;
    case 'git':
      spec.git = { ...baseConfig, tokenUser: data.tokenUser };
      break;
    case 'local':
      spec.local = {
        path: data.path,
      };
      spec.workflows = spec.workflows.filter((v) => v !== 'branch'); // branch only supported by github
      break;
  }

  // We need to deep clone the data, so it doesn't become immutable
  return structuredClone(spec);
};

export const specToData = (spec: RepositorySpec): RepositoryFormData => {
  const remoteConfig = spec.github || spec.gitlab || spec.bitbucket || spec.git;
  // tokenUser is only available for bitbucket and pure git
  const tokenUser = spec.bitbucket?.tokenUser ?? spec.git?.tokenUser;

  return structuredClone({
    ...spec,
    ...remoteConfig,
    ...spec.local,
    branch: remoteConfig?.branch || '',
    branchOptions: spec.branch,
    url: remoteConfig?.url || '',
    tokenUser: tokenUser || '',
    generateDashboardPreviews: spec.github?.generateDashboardPreviews || false,
    readOnly: !spec.workflows.length,
    prWorkflow: spec.workflows.includes('branch'),
    enablePushToConfiguredBranch: spec.workflows.includes('write'),
    connectionName: spec.connection?.name,
    signingFormat: spec.commit?.signingFormat ?? 'none',
  });
};

export const generateRepositoryTitle = (repository: Pick<RepositoryFormData, 'type' | 'url' | 'path'>): string => {
  switch (repository.type) {
    case 'github':
    case 'gitlab':
    case 'bitbucket':
    case 'git': {
      const repoUrl = repository.url ?? repository.type;
      return repoUrl.replace(/^https?:\/\/[^\/]+\//, '');
    }
    case 'local':
      return repository.path ?? 'local';
    default:
      return '';
  }
};
