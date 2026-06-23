import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect, useMemo, useRef } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type WorkflowOption } from '../types';
import { type BranchTemplateVars, generateBranchToken, renderBranchName } from '../utils/branchName';

interface UseBranchTemplateArgs {
  repository: RepositoryView | undefined;
  vars: BranchTemplateVars;
  workflow: WorkflowOption | undefined;
  /** Must not mark the field dirty, or the auto-fill would read as a user edit. */
  setBranch: (value: string) => void;
}

/**
 * Pre-fills the branch ("ref") field from repository.branchOptions.nameTemplate and reports whether
 * the field is enforced (read-only). The branch name only applies to the branch (pull request)
 * workflow on git repos, so it stays inert for the write workflow.
 */
export function useBranchTemplate({ repository, vars, workflow, setBranch }: UseBranchTemplateArgs): {
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
  // Enforcement requires an actual template: with no template there is nothing to enforce, so the
  // field stays editable rather than freezing read-only on the auto-generated ref.
  const locked = active && enforce;
  const rendered = active ? renderBranchName(template, { ...vars, random }) : '';

  // Apply the rendered name whenever it changes — on entering the branch workflow (rendered goes
  // from '' to the template) and on each template-variable change — without ever permanently
  // freezing. The field stays editable; a manual edit persists until the next variable change
  // re-renders the template. `enforce` still makes the field read-only via `locked`.
  const lastApplied = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!active || !rendered) {
      lastApplied.current = undefined;
      return;
    }
    if (rendered !== lastApplied.current) {
      lastApplied.current = rendered;
      setBranch(rendered);
    }
  }, [active, rendered, setBranch]);

  return { locked };
}
