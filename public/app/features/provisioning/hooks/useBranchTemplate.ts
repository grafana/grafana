import { useEffect, useMemo, useRef } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type BranchTemplateVars, generateBranchToken, renderBranchName } from '../utils/branchName';

interface UseBranchTemplateArgs {
  repository: RepositoryView | undefined;
  vars: BranchTemplateVars;
  /** The current ref creates a branch; `undefined` while unresolved. The template only names new branches. */
  isNewBranch: boolean | undefined;
  /** Current value of the `ref` field, so the hook can detect a manual edit and stop auto-filling. */
  value: string;
  /** Must not mark the field dirty, or the auto-fill would read as a user edit. */
  setBranch: (value: string) => void;
}

/**
 * Pre-fills the branch ("ref") field from repository.branchOptions.nameTemplate and reports whether
 * the field is enforced (read-only). The template names a branch the commit creates, so it only
 * applies when the ref is a new branch (or the template is enforced).
 */
export function useBranchTemplate({ repository, vars, isNewBranch, value, setBranch }: UseBranchTemplateArgs): {
  locked: boolean;
} {
  // One token per drawer open; stable across re-renders so the name doesn't churn as vars change.
  const random = useMemo(() => generateBranchToken(), []);

  const template = repository?.branchOptions?.nameTemplate;
  // Enforcement needs the branch workflow: a write-only repository never leaves the configured branch.
  const enforce =
    Boolean(repository?.branchOptions?.enforceTemplate) && Boolean(repository?.workflows?.includes('branch'));
  // A template that sanitises to '' (e.g. an all-punctuation title) leaves the field alone and never locks it.
  const rendered = template?.trim() ? renderBranchName(template, { ...vars, random }) : '';
  // An enforced template always names the branch (its default ref is a generated branch, never an
  // existing one), so it applies without waiting for the refs to confirm the ref is new.
  const active = Boolean(rendered) && (isNewBranch === true || enforce);
  const locked = active && enforce;

  // Fill the rendered name when the ref first becomes a new branch, then keep it in sync with the
  // live template variables — but stop once the user edits the field. We can't gate on react-hook-
  // form's dirty state: typing a new branch name already marks `ref` dirty, which would suppress the
  // first fill. Instead we latch on any change the hook did not write itself, including edits made
  // while the refs are still resolving, so a late activation never reclaims an edited field.
  const lastApplied = useRef<string | undefined>(undefined);
  const userEdited = useRef(false);
  const previous = useRef<{ value: string; isNewBranch: boolean | undefined } | undefined>(undefined);
  useEffect(() => {
    const prev = previous.current;
    previous.current = { value, isNewBranch };

    // Enforced templates render the field read-only, so a value diverging from what the hook last
    // wrote is a form reset (the Save drawer re-runs reset on parent re-renders, e.g. selecting a
    // target folder), never a user edit. Keep re-applying the rendered name so the enforced branch
    // survives the reset instead of latching off.
    if (enforce) {
      if (rendered && rendered !== value) {
        lastApplied.current = rendered;
        setBranch(rendered);
      }
      return;
    }
    // The configured branch or an existing one: not in new-branch mode. Leaving it later is a fresh
    // entry the template fills again.
    if (isNewBranch === false) {
      lastApplied.current = undefined;
      userEdited.current = false;
      return;
    }
    // A value the hook did not write, changed while already on (or still resolving) a new branch,
    // is a user edit. A change that moved the field off a known branch is the entry into
    // new-branch mode, which the template fills.
    if (prev && prev.isNewBranch !== false && value !== prev.value && value !== lastApplied.current) {
      userEdited.current = true;
    }
    if (!active || userEdited.current) {
      return;
    }
    if (rendered !== lastApplied.current) {
      lastApplied.current = rendered;
      setBranch(rendered);
    }
  }, [active, enforce, rendered, value, isNewBranch, setBranch]);

  return { locked };
}
