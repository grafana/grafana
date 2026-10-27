import { useMemo } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import {
  type BranchTemplateVars,
  generateBranchToken,
  isBranchTemplateEnforced,
  renderBranchName,
} from '../utils/branchName';

import { useTemplateAutofill } from './useTemplateAutofill';

interface UseBranchTemplateArgs {
  repository: RepositoryView | undefined;
  vars: BranchTemplateVars;
  /** The current ref creates a branch. The template only names new branches. */
  isNewBranch: boolean;
  /** Current value of the `ref` field. */
  value: string;
  /** True once the user edited the field. The template is a default, so it never replaces an edit. */
  isDirty: boolean;
  /** Must not mark the field dirty, or the auto-fill would read as a user edit. */
  setBranch: (value: string) => void;
}

/**
 * Pre-fills the branch ("ref") field from repository.branchOptions.nameTemplate and reports whether
 * the field is enforced (read-only). The template names a branch the commit creates, so it only
 * applies when the ref is a new branch (or the template is enforced).
 */
export function useBranchTemplate({
  repository,
  vars,
  isNewBranch,
  value,
  isDirty,
  setBranch,
}: UseBranchTemplateArgs): { locked: boolean } {
  // One token per drawer open; stable across re-renders so the name doesn't churn as vars change.
  const random = useMemo(() => generateBranchToken(), []);

  const enforce = isBranchTemplateEnforced(repository);
  // '' for a blank template or one that sanitises away (e.g. an all-punctuation title): the field is
  // left alone and never locked, so the user can still set a valid branch.
  const rendered = renderBranchName(repository?.branchOptions?.nameTemplate, { ...vars, random });
  const locked = enforce && Boolean(rendered);

  useTemplateAutofill({
    // An enforced template always names the branch, so it applies before the refs confirm the ref is new.
    active: enforce || isNewBranch,
    rendered,
    value,
    // The enforced field is read-only, so a diverging value is a form reset (the Save drawer re-runs
    // reset on parent re-renders), never an edit: keep re-applying instead of freezing.
    isDirty: !enforce && isDirty,
    setValue: setBranch,
  });

  return { locked };
}
