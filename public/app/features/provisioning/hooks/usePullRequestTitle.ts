import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useMemo } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type WorkflowOption } from '../types';
import { type BranchTemplateVars, generateBranchToken } from '../utils/branchName';
import { renderPullRequestTitle } from '../utils/pullRequestTitle';

interface UsePullRequestTitleArgs {
  repository: RepositoryView | undefined;
  vars: BranchTemplateVars;
  workflow: WorkflowOption | undefined;
}

/** Renders repository.pullRequest.titleTemplate for the branch (pull request) workflow.
 *  Returns '' (→ no prefill, provider uses the commit-message first line) when the flag is off,
 *  the workflow isn't `branch`, or no template is set. enforceTemplate has no effect here. */
export function usePullRequestTitle({ repository, vars, workflow }: UsePullRequestTitleArgs): { prTitle: string } {
  const flagEnabled = useBooleanFlagValue('provisioning.gitConventions', false);
  // One token per drawer open; stable across re-renders. {{random}} is rarely used in PR titles
  // but must still be substituted so a literal {{random}} never leaks into the title.
  const random = useMemo(() => generateBranchToken(), []);
  const template = repository?.pullRequest?.titleTemplate;
  // repository.pullRequest.enforceTemplate (documented as "the PR title field in Save drawers is
  // read-only") is intentionally NOT honored here: this hook renders no PR-title input — the title
  // only pre-fills the provider's PR page — so there is nothing to lock. Wire it up if/when a
  // PR-title field is added to the Save drawer.
  const active = flagEnabled && workflow === 'branch' && Boolean(template?.trim());
  const prTitle = active ? renderPullRequestTitle(template, { ...vars, random }) : '';
  return { prTitle };
}
