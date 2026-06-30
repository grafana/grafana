import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect, useMemo, useRef } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type WorkflowOption } from '../types';
import { type BranchTemplateVars, generateBranchToken, renderBranchName } from '../utils/branchName';

interface UseBranchTemplateArgs {
  repository: RepositoryView | undefined;
  vars: BranchTemplateVars;
  workflow: WorkflowOption | undefined;
  /** Current value of the `ref` field, so the hook can detect a manual edit and stop auto-filling. */
  value: string;
  /** Must not mark the field dirty, or the auto-fill would read as a user edit. */
  setBranch: (value: string) => void;
}

/**
 * Pre-fills the branch ("ref") field from repository.branchOptions.nameTemplate and reports whether
 * the field is enforced (read-only). The branch name only applies to the branch (pull request)
 * workflow on git repos, so it stays inert for the write workflow.
 */
export function useBranchTemplate({ repository, vars, workflow, value, setBranch }: UseBranchTemplateArgs): {
  locked: boolean;
} {
  const flagEnabled = useBooleanFlagValue('provisioning.gitConventions', false);
  // One token per drawer open; stable across re-renders so the name doesn't churn as vars change.
  const random = useMemo(() => generateBranchToken(), []);

  const isBranchWorkflow = workflow === 'branch';
  const template = repository?.branchOptions?.nameTemplate;
  const enforce = repository?.branchOptions?.enforceTemplate ?? false;
  const hasTemplate = Boolean(template?.trim());

  const active = flagEnabled && isBranchWorkflow && hasTemplate;
  const rendered = active ? renderBranchName(template, { ...vars, random }) : '';
  // Enforcement requires an actual template AND a non-empty render: with no template (nothing to
  // enforce) or a template that sanitises to '' (e.g. an all-punctuation or non-Latin title), the
  // field stays editable on the auto-generated ref instead of freezing read-only on a non-template
  // name the user could not fix.
  const locked = active && enforce && Boolean(rendered);

  // Fill the rendered name when the branch workflow is first entered, then keep it in sync with the
  // live template variables — but stop once the user edits the field. We can't gate on react-hook-
  // form's dirty state: reaching the branch workflow by typing a branch name already marks `ref`
  // dirty, which would suppress the first fill. Instead we latch as soon as the field value diverges
  // from the value the hook last wrote itself. `enforce` still makes the field read-only via `locked`.
  const lastApplied = useRef<string | undefined>(undefined);
  const userEdited = useRef(false);
  useEffect(() => {
    if (!active || !rendered) {
      lastApplied.current = undefined;
      userEdited.current = false;
      return;
    }
    // Field no longer holds the value we last wrote → the user edited it; freeze from now on.
    if (lastApplied.current !== undefined && value !== lastApplied.current) {
      userEdited.current = true;
    }
    if (userEdited.current) {
      return;
    }
    if (rendered !== lastApplied.current) {
      lastApplied.current = rendered;
      setBranch(rendered);
    }
  }, [active, rendered, value, setBranch]);

  return { locked };
}
