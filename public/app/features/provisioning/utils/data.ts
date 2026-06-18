import { type CommitOptions, type InlineSecureValue, type RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { type RepositoryFormData } from '../types';

// Template field names across the git-convention option groups.
type TemplateFieldKey = 'singleResourceMessageTemplate' | 'nameTemplate' | 'titleTemplate';

// The git-convention option groups (commit, branch, pull request — and signing
// next) all share the same shape: a single template string field whose name
// varies per group, plus an enforce toggle.
type TemplateOptions<TemplateKey extends TemplateFieldKey> = Partial<Record<TemplateKey, string>> & {
  enforceTemplate?: boolean;
};

// Commit options extend the shared template shape with signing fields.
const buildCommitOptions = (data: RepositoryFormData): CommitOptions | undefined => {
  const base = buildTemplateOptions(
    'singleResourceMessageTemplate',
    data.commit?.singleResourceMessageTemplate,
    data.commit?.enforceTemplate
  );
  const signerName = data.commit?.signerName?.trim();
  const signerEmail = data.commit?.signerEmail?.trim();
  const signingMethod = data.signingMethod;

  if (!base && !signerName && !signerEmail && !signingMethod) {
    return undefined;
  }

  const commit: CommitOptions = { ...base };
  if (signerName) {
    commit.signerName = signerName;
  }
  if (signerEmail) {
    commit.signerEmail = signerEmail;
  }
  if (signingMethod) {
    commit.signingMethod = signingMethod;
  }
  if (data.smimeCertificate) {
    commit.smimeCertificate = data.smimeCertificate;
  }
  return commit;
};

// Build a spec-level options group from its form values, trimming the template
// and omitting empty fields so we don't persist blank templates. Returns
// undefined when nothing is configured. Keeps all the groups in sync.
const buildTemplateOptions = <TemplateKey extends TemplateFieldKey>(
  templateKey: TemplateKey,
  template?: string,
  enforceTemplate?: boolean
): TemplateOptions<TemplateKey> | undefined => {
  const trimmedTemplate = template?.trim();

  if (!trimmedTemplate && !enforceTemplate) {
    return undefined;
  }

  const templatePart: Partial<Record<TemplateKey, string>> = {};
  if (trimmedTemplate) {
    templatePart[templateKey] = trimmedTemplate;
  }

  return { ...templatePart, ...(enforceTemplate ? { enforceTemplate } : {}) };
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

  const branch = buildTemplateOptions(
    'nameTemplate',
    data.branchOptions?.nameTemplate,
    data.branchOptions?.enforceTemplate
  );
  if (branch) {
    spec.branch = branch;
  }

  const pullRequest = buildTemplateOptions(
    'titleTemplate',
    data.pullRequest?.titleTemplate,
    data.pullRequest?.enforceTemplate
  );
  if (pullRequest) {
    spec.pullRequest = pullRequest;
  }

  if (data.webhook?.baseUrl || data.webhook?.disabled) {
    spec.webhook = {
      ...(data.webhook.baseUrl ? { baseUrl: data.webhook.baseUrl } : {}),
      ...(data.webhook.disabled ? { disabled: true } : {}),
    };
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

/**
 * Derive the `secure.commitSigningKey` entry from the form's signing state.
 * Returns `{ create }` when signing is enabled and a new key was entered,
 * `{ remove: true }` when signing is disabled but a key was previously stored,
 * and `undefined` when there is nothing to change. Both submit paths
 * (config edit and wizard create) share this so the set/keep/remove decision
 * lives in one place.
 */
export const deriveSigningKeySecret = (
  data: RepositoryFormData,
  existingKeyConfigured: boolean
): InlineSecureValue | undefined => {
  if (data.signingMethod) {
    return data.commitSigningKey ? { create: data.commitSigningKey } : undefined;
  }
  return existingKeyConfigured ? { remove: true } : undefined;
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
    signingMethod: spec.commit?.signingMethod ?? '',
    smimeCertificate: spec.commit?.smimeCertificate ?? '',
    commitSigningKey: '',
    commit: { ...spec.commit, signerName: spec.commit?.signerName ?? '', signerEmail: spec.commit?.signerEmail ?? '' },
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
