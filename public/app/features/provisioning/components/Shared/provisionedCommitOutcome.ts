import { textUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { type RepositoryUrLs, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { type RepoType } from 'app/features/provisioning/Wizard/types';

import { COMMIT_OUTCOME_STORAGE_KEY } from '../../constants';
import { isValidRepoType } from '../../guards';
import { appendPullRequestTitleParam } from '../../utils/pullRequestTitle';
import { isResourceKindKey, type ResourceKindKey } from '../../utils/resourceKinds';

const COMMIT_ACTIONS = ['create', 'update', 'delete'] as const;

export type CommitAction = (typeof COMMIT_ACTIONS)[number];

export interface ProvisionedCommitOutcome {
  action: CommitAction;
  branch?: string;
  configuredBranch?: string;
  repoType?: RepoType;
  repoUrl?: string;
  message?: string;
  sourceUrl?: string;
  prUrl?: string;
  filePath?: string;
  pendingSync?: boolean;
}

export function buildCommitOutcome(args: {
  action: CommitAction;
  ref?: string;
  urls?: RepositoryUrLs;
  message?: string;
  prTitle?: string;
  repository?: RepositoryView;
  filePath?: string;
  pendingSync?: boolean;
}): ProvisionedCommitOutcome {
  const { action, ref, urls, message, prTitle, repository, filePath, pendingSync } = args;
  return {
    action,
    branch: ref,
    configuredBranch: repository?.branch,
    repoType: repository?.type,
    repoUrl: urls?.repositoryURL ?? repository?.url,
    message,
    sourceUrl: action === 'delete' ? undefined : urls?.sourceURL,
    prUrl: appendPullRequestTitleParam(urls?.newPullRequestURL, repository?.type, prTitle),
    filePath,
    pendingSync,
  };
}

export function isDirectCommit({ branch, configuredBranch }: ProvisionedCommitOutcome): boolean {
  return !branch || branch === configuredBranch;
}

export interface StoredCommitOutcome {
  outcome: ProvisionedCommitOutcome;
  kindKey?: ResourceKindKey;
  resourceName?: string;
}

export function storeCommitOutcome({ outcome, kindKey, resourceName }: StoredCommitOutcome) {
  const path = locationService.getLocation().pathname;
  try {
    window.sessionStorage.setItem(
      COMMIT_OUTCOME_STORAGE_KEY,
      JSON.stringify({ ...outcome, kindKey, resourceName, path })
    );
  } catch {}
}

export function clearStoredCommitOutcome() {
  try {
    window.sessionStorage.removeItem(COMMIT_OUTCOME_STORAGE_KEY);
  } catch {}
}

export function parseStoredCommitOutcome(raw: string, pathname: string): StoredCommitOutcome | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record: object = value;
  const text = (key: string) => {
    const field = Reflect.get(record, key);
    return typeof field === 'string' ? field : undefined;
  };
  const url = (key: string) => {
    const field = text(key);
    return field ? textUtil.sanitizeUrl(field) : undefined;
  };
  const action = COMMIT_ACTIONS.find((a) => a === text('action'));
  if (!action || text('path') !== pathname) {
    return undefined;
  }
  const repoType = text('repoType');
  const kindKey = text('kindKey');
  return {
    kindKey: kindKey && isResourceKindKey(kindKey) ? kindKey : undefined,
    resourceName: text('resourceName'),
    outcome: {
      action,
      branch: text('branch'),
      configuredBranch: text('configuredBranch'),
      repoType: isValidRepoType(repoType) ? repoType : undefined,
      repoUrl: url('repoUrl'),
      message: text('message'),
      sourceUrl: url('sourceUrl'),
      prUrl: url('prUrl'),
      filePath: text('filePath'),
      pendingSync: Reflect.get(record, 'pendingSync') === true,
    },
  };
}
