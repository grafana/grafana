import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type CommitTemplateVars, renderCommitMessage } from '../utils/commitMessage';

interface UseCommitMessageTemplateArgs {
  repository: RepositoryView | undefined;
  vars: CommitTemplateVars;
  /** Current value of the form's `comment` field. */
  comment: string;
  /** Whether the user has edited `comment` (react-hook-form dirty state). */
  isCommentDirty: boolean;
  /** Sets the `comment` field without marking it dirty. */
  setComment: (value: string) => void;
}

/**
 * Drives the Save-drawer "Comment" field from the repository commit message
 * template, gated behind the provisioning.gitConventions flag. Pre-fills on
 * mount, re-renders as `vars` change, locks the field when enforcement is on,
 * and stops overwriting once the user has edited it. Returns whether the field
 * must render read-only. Purely additive: it never touches submit logic.
 *
 * Takes plain values rather than the form object so it carries no generics or
 * type assertions; each caller wires its own concretely-typed `comment` field.
 */
export function useCommitMessageTemplate({
  repository,
  vars,
  comment,
  isCommentDirty,
  setComment,
}: UseCommitMessageTemplateArgs): { locked: boolean } {
  const flagEnabled = useBooleanFlagValue('provisioning.gitConventions', false);
  const template = repository?.commit?.singleResourceMessageTemplate;
  const enforce = repository?.commit?.enforceTemplate ?? false;

  // Active when the flag is on AND there's something to show: a configured
  // template, or enforcement (which locks the field to the rendered default).
  const active = flagEnabled && (Boolean(template?.trim()) || enforce);
  const locked = flagEnabled && enforce;
  const rendered = active ? renderCommitMessage(template, vars) : '';

  useEffect(() => {
    if (!active) {
      return;
    }
    // Non-enforced: once the user has edited the field, leave it alone.
    if (!locked && isCommentDirty) {
      return;
    }
    // `comment` is a dependency, so an external reset(defaultValues) that wipes
    // the field re-runs this effect and re-fills it.
    if (comment !== rendered) {
      setComment(rendered);
    }
  }, [active, locked, isCommentDirty, comment, rendered, setComment]);

  return { locked };
}
