import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type CommitTemplateVars, renderCommitMessage } from '../utils/commitMessage';

interface UseCommitMessageTemplateArgs {
  repository: RepositoryView | undefined;
  vars: CommitTemplateVars;
  comment: string;
  isCommentDirty: boolean;
  /** Must not mark the field dirty, or the auto-fill would read as a user edit. */
  setComment: (value: string) => void;
}

/**
 * Drives the save-dialog "Comment" field from the repository commit message template.
 *
 * Takes plain values rather than the form object so it stays free of generics and type
 * assertions; each concretely-typed caller wires its own `comment` field.
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

  // Enforcement activates the field even without a template, locking it to the default.
  const active = flagEnabled && (Boolean(template?.trim()) || enforce);
  const locked = flagEnabled && enforce;
  const rendered = active ? renderCommitMessage(template, vars) : '';

  useEffect(() => {
    if (!active) {
      return;
    }
    // Once the user edits a non-enforced field, stop overwriting their text.
    if (!locked && isCommentDirty) {
      return;
    }
    // `comment` stays in the deps so an external reset that clears it triggers a re-fill.
    if (comment !== rendered) {
      setComment(rendered);
    }
  }, [active, locked, isCommentDirty, comment, rendered, setComment]);

  return { locked };
}
