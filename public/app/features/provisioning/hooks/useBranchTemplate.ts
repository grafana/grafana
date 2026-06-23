import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useMemo } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type WorkflowOption } from '../types';
import { type BranchTemplateVars, generateBranchToken, renderBranchName } from '../utils/branchName';

import { useTemplateAutofill } from './useTemplateAutofill';

interface UseBranchTemplateArgs {
  repository: RepositoryView | undefined;
  vars: BranchTemplateVars;
  workflow: WorkflowOption | undefined;
  branch: string;
  isBranchDirty: boolean;
  /** Must not mark the field dirty, or the auto-fill would read as a user edit. */
  setBranch: (value: string) => void;
}

/**
 * Pre-fills the branch ("ref") field from repository.branchOptions.nameTemplate and reports whether
 * the field is enforced (read-only). The branch name only applies to the branch (pull request)
 * workflow on git repos, so it stays inert for the write workflow.
 */
export function useBranchTemplate({
  repository,
  vars,
  workflow,
  branch,
  isBranchDirty,
  setBranch,
}: UseBranchTemplateArgs): { locked: boolean } {
  const flagEnabled = useBooleanFlagValue('provisioning.gitConventions', false);
  // One token per drawer open; stable across re-renders so the name doesn't churn as vars change.
  const random = useMemo(() => generateBranchToken(), []);

  const isBranchWorkflow = workflow === 'branch';
  const template = repository?.branchOptions?.nameTemplate;
  const enforce = repository?.branchOptions?.enforceTemplate ?? false;
  const hasTemplate = Boolean(template?.trim());

  const active = flagEnabled && isBranchWorkflow && hasTemplate;
  const locked = flagEnabled && isBranchWorkflow && enforce;
  const rendered = active ? renderBranchName(template, { ...vars, random }) : '';

  // No `!locked` here (unlike commit): when locked the value still lives in the form `ref`, so the
  // field must stay synced to the rendered name. Locked + read-only means it never becomes dirty.
  useTemplateAutofill({ active, rendered, value: branch, isDirty: isBranchDirty, setValue: setBranch });

  return { locked };
}
