import { type RepositoryUrLs, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { type RepoType } from 'app/features/provisioning/Wizard/types';

import { appendPullRequestTitleParam } from '../../utils/pullRequestTitle';

import { type CommitAction } from './ProvisionedCommitSuccess';

/**
 * A landed commit, in the shape the drawer reports it: where it went, and where to go next.
 *
 * It is a snapshot rather than a live lookup because the write moves the ground underneath one — a
 * created resource stops being a new save, and a resource committed to a branch is not in Grafana at
 * all, so re-resolving its repository afterwards finds nothing. Build it as the commit lands.
 */
export interface ProvisionedCommitOutcome {
  action: CommitAction;
  /** Branch the commit landed on; absent for a direct write to the configured branch. */
  branch?: string;
  configuredBranch?: string;
  repoType?: RepoType;
  /** Repository base URL, for the branch links and the way out to the provider. */
  repoUrl?: string;
  message?: string;
  /** Link to the committed file. */
  sourceUrl?: string;
  /** Pull request the pushed branch opens, where the provider has one. */
  prUrl?: string;
  /** How many resources the commit covers. A bulk action passes its selection count. */
  count?: number;
}

interface CommitOutcomeArgs {
  action: CommitAction;
  /** Branch the write reported landing on; absent for a direct write to the configured branch. */
  ref?: string;
  urls?: RepositoryUrLs;
  message?: string;
  /** Rendered pull-request title, which prefills the provider's "open pull request" form. */
  prTitle?: string;
  repository?: RepositoryView;
  count?: number;
}

/**
 * Normalizes what a write or a job reported into the outcome the drawer shows, so every kind reports
 * a commit the same way. The response's own URLs win over the repository's, which only describe
 * where the repository is rather than where this commit landed.
 */
export function buildCommitOutcome({
  action,
  ref,
  urls,
  message,
  prTitle,
  repository,
  count,
}: CommitOutcomeArgs): ProvisionedCommitOutcome {
  return {
    action,
    branch: ref,
    configuredBranch: repository?.branch,
    repoType: repository?.type,
    repoUrl: urls?.repositoryURL ?? repository?.url,
    message,
    sourceUrl: urls?.sourceURL,
    prUrl: appendPullRequestTitleParam(urls?.newPullRequestURL, repository?.type, prTitle),
    count,
  };
}

/** Whether the commit went straight to the configured branch, so it is live in Grafana already. */
export function isDirectCommit({ branch, configuredBranch }: ProvisionedCommitOutcome): boolean {
  return !branch || branch === configuredBranch;
}
