import type * as z from 'zod';

/**
 * The problems an expression can have when someone tries to save it.
 *
 * The schemas record one of these ids rather than a sentence, because they are module-level
 * constants and `t()` cannot be called there. `./issueMessages` turns an id into text.
 */
export const EXPRESSION_ISSUE_IDS = [
  'math.expression.required',

  'sql.expression.required',

  'reduce.expression.required',
  'reduce.replace-value.required',

  'resample.expression.required',
  'resample.window.required',

  'classic.conditions.required',
  'classic.condition.query.required',
  'classic.condition.params.invalid',

  'threshold.expression.required',
  'threshold.expression.bare-name',
  'threshold.conditions.one-only',
  'threshold.value.required',

  // The recovery threshold, i.e. the value an alert has to come back past before it stops firing.
  'threshold.recovery.required',
  'threshold.recovery.at-most',
  'threshold.recovery.at-least',
  'threshold.recovery.less-than',
  'threshold.recovery.more-than',
  'threshold.recovery.different',
  'threshold.recovery.same',
] as const;

export type ExpressionIssueId = (typeof EXPRESSION_ISSUE_IDS)[number];

/** Somewhere inside an expression model, e.g. `['conditions', 0, 'evaluator', 'params', 1]`. */
export type FieldPath = ReadonlyArray<string | number>;

/** One problem with an expression, and which field it is about. */
export interface ExpressionIssue {
  id: ExpressionIssueId;
  /** The field this is about, so it can be shown next to the right input. */
  path: FieldPath;
  /** The number the message needs, where it has one - a threshold to stay under, say. */
  limit?: number;
}

function isIssueId(value: unknown): value is ExpressionIssueId {
  return EXPRESSION_ISSUE_IDS.some((id) => id === value);
}

/**
 * Pulls our own issues out of a Zod error. Anything we did not put there ourselves is skipped -
 * those are shape problems, which the save rules never see because reading already fixed them up.
 */
export function toExpressionIssues(error: z.ZodError): ExpressionIssue[] {
  const issues: ExpressionIssue[] = [];

  for (const issue of error.issues) {
    if (!isIssueId(issue.message)) {
      continue;
    }

    const limit = 'params' in issue && typeof issue.params?.limit === 'number' ? issue.params.limit : undefined;
    // Zod allows symbols in a path; ours never has any, so drop them rather than widen the type.
    const path = issue.path.filter((segment): segment is string | number => typeof segment !== 'symbol');
    issues.push({ id: issue.message, path, limit });
  }

  return issues;
}

/** The problem at exactly this field, if there is one. */
export function issueAt(issues: ExpressionIssue[], path: FieldPath): ExpressionIssue | undefined {
  return issues.find((issue) => issue.path.length === path.length && issue.path.every((p, i) => p === path[i]));
}

/** The problems that are not about any of these fields, so they have nowhere specific to show. */
export function issuesElsewhere(issues: ExpressionIssue[], paths: FieldPath[]): ExpressionIssue[] {
  return issues.filter((issue) => !paths.some((path) => issueAt([issue], path)));
}
