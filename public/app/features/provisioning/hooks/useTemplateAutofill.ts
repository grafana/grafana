import { useEffect } from 'react';

interface UseTemplateAutofillArgs {
  /** Pre-fill is active: feature flag on, domain conditions met, and a template is set.
   *  Callers that bypass the form when locked (commit) pass `active && !locked`. */
  active: boolean;
  /** Resolved value to fill. Empty string means "leave the field untouched". */
  rendered: string;
  /** Current field value. Kept in deps so an external reset that clears it re-triggers the fill. */
  value: string;
  /** True once the user edited the field; freezes the autofill. */
  isDirty: boolean;
  /** Must not mark the field dirty, or the fill would read as a user edit. */
  setValue: (value: string) => void;
}

/**
 * Shared pre-fill effect for git-convention template fields (commit message, branch name):
 * writes `rendered` into the field while the user hasn't touched it, re-running as `rendered`
 * tracks live template variables. Frozen once `isDirty`; an empty `rendered` leaves the field as-is.
 */
export function useTemplateAutofill({ active, rendered, value, isDirty, setValue }: UseTemplateAutofillArgs): void {
  useEffect(() => {
    if (!active || isDirty || !rendered) {
      return;
    }
    if (value !== rendered) {
      setValue(rendered);
    }
  }, [active, isDirty, value, rendered, setValue]);
}
