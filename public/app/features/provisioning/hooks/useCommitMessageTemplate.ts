import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type CommitTemplateVars, getResourceCommitMessage, renderCommitMessage } from '../utils/commitMessage';

import { useTemplateAutofill } from './useTemplateAutofill';

interface UseCommitMessageTemplateArgs {
  repository: RepositoryView | undefined;
  vars: CommitTemplateVars;
  comment: string;
  isCommentDirty: boolean;
  /** Must not mark the field dirty, or the auto-fill would read as a user edit. */
  setComment: (value: string) => void;
  /** Fallback message used when no template is configured. */
  fallbackMessage?: string;
}

/**
 * Resolves the repository commit-message template into the editable "Comment" field and the commit
 * message that is actually sent.
 *
 * Takes plain values rather than the form object so it stays free of generics and type assertions.
 *
 * `locked`: the field is enforced/read-only, so render `message` instead of binding it to form state.
 * `message`: the resolved commit message to commit.
 */
export function useCommitMessageTemplate({
  repository,
  vars,
  comment,
  isCommentDirty,
  setComment,
  fallbackMessage,
}: UseCommitMessageTemplateArgs): { locked: boolean; message: string } {
  const template = repository?.commit?.singleResourceMessageTemplate;
  const locked = repository?.commit?.enforceTemplate ?? false;

  // Enforced repos commit the template, not the field, so drop the comment when locked.
  const message = getResourceCommitMessage({ comment: locked ? '' : comment, repository, fallbackMessage, ...vars });

  // Pre-fill only the editable field; enforced repos render `message` read-only instead, so there is
  // nothing to fill. The template tracks live `vars` and the repo usually resolves after the form
  // mounts, so a static form default would be stale.
  const prefill = !locked && Boolean(template?.trim());
  useTemplateAutofill({
    active: prefill,
    rendered: prefill ? renderCommitMessage(template, vars, fallbackMessage) : '',
    value: comment,
    isDirty: isCommentDirty,
    setValue: setComment,
  });

  return { locked, message };
}
