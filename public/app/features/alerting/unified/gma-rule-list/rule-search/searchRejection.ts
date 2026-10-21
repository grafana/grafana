import * as z from 'zod';

import { isFetchError } from '@grafana/runtime';

import { type FilterIssue } from './parser';
import { type SourcedLeaf } from './searchQueryLeaves';

/**
 * The issues for a search the rule search refused as invalid (422), each naming the filter whose leaf it
 * rejected. Undefined for any other failure, which the list shows with Retry.
 */
export function getRejectionIssues(error: unknown, leaves: SourcedLeaf[]): FilterIssue[] | undefined {
  if (!isFetchError(error) || error.status !== 422) {
    return undefined;
  }

  const status = rejectionSchema.safeParse(error.data);
  const causes = status.success ? (status.data.details?.causes ?? []) : [];
  if (causes.length === 0) {
    const message = status.success ? (status.data.message ?? '') : '';
    return [{ key: null, reason: 'rejected', message }];
  }

  return causes.map(({ field = '', message }) => ({
    key: leaves[leafIndex(field, leaves.length) ?? -1]?.key ?? null,
    reason: 'rejected',
    message,
  }));
}

// The cause's path into the request: `where.and[1].regex.pattern` is the second leaf of an `and`, and
// `where.regex.pattern` the only leaf when there is no `and`.
function leafIndex(field: string, leafCount: number): number | undefined {
  const inAnd = /^where\.and\[(\d+)\]/.exec(field);
  if (inAnd) {
    return Number(inAnd[1]);
  }
  return leafCount === 1 && /^where\.(text|filter|regex)\b/.test(field) ? 0 : undefined;
}

// The Kubernetes Status the server answers a 422 with; only what the issues read.
const rejectionSchema = z.object({
  message: z.string().optional(),
  details: z
    .object({
      causes: z.array(z.object({ field: z.string().optional(), message: z.string() })).optional(),
    })
    .optional(),
});
