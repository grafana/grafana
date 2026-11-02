import { type FilterDefinition, type RuleSearchSchema } from './filterDefinitions';
import { type SharedRuleFilter } from './sharedRuleFilter';
import { tokenize } from './tokenizer';

/** A reason the page can't search the query as typed; the page shows each one and sends no request. */
export type FilterIssue =
  | { key: string; reason: 'invalid' | 'unavailable' }
  | { key: string; reason: 'renamed'; from: string; to: string }
  | { key: null; reason: 'wildcardInText' | 'unclosedQuote' }
  /** The rule search refused the request; `key` is null when the refusal names no filter, or the search text. */
  | { key: string | null; reason: 'rejected'; message: string };

export interface ParsedSearch<Filter extends SharedRuleFilter> {
  filter: Filter;
  issues: FilterIssue[];
}

/**
 * Parses the query into a filter, then gives feedback on the result. Parsing rejects only a value the
 * filter can't hold; feedback judges what parsing accepted, so `state:bogus` is a parse rejection and
 * `folder:f*` is feedback.
 */
export function parse<Filter extends SharedRuleFilter>(
  query: string,
  schema: RuleSearchSchema<Filter>
): ParsedSearch<Filter> {
  const { filter, rejected } = parseFilter(query, schema);
  return { filter, issues: getFeedback(filter, rejected, schema.filters) };
}

// Parsing

/** A token parsing couldn't turn into a filter value; `key` is null for free text with an unclosed quote. */
interface RejectedToken {
  key: string | null;
  /** A renamed value as typed, and the value that replaces it. */
  renamed?: { from: string; to: string };
}

function parseFilter<Filter extends SharedRuleFilter>(
  query: string,
  { filters, createEmptyFilter }: RuleSearchSchema<Filter>
): { filter: Filter; rejected: RejectedToken[] } {
  const byKey = new Map<string, FilterDefinition<Filter>>(filters.map((definition) => [definition.key, definition]));
  const filter = createEmptyFilter();
  const rejected: RejectedToken[] = [];

  for (const raw of tokenize(query)) {
    const definition = raw.key === null ? undefined : byKey.get(raw.key);

    // A key this page has no filter for is part of a title, e.g. a rule named `foo:bar`.
    if (definition === undefined) {
      if (!raw.closed) {
        rejected.push({ key: null });
      } else if (raw.key !== null) {
        filter.text.push(`${raw.key}:${raw.value}`);
      } else if (raw.value.length > 0) {
        filter.text.push(raw.value);
      }
      continue;
    }

    const accepted = raw.value.length > 0 && raw.closed && definition.apply(filter, raw.value);
    if (!accepted) {
      const to = definition.renamedValues?.[raw.value.toLowerCase()];
      rejected.push(to ? { key: definition.key, renamed: { from: raw.value, to } } : { key: definition.key });
    }
  }

  return { filter, rejected };
}

// Feedback

function getFeedback<Filter extends SharedRuleFilter>(
  filter: Filter,
  rejected: RejectedToken[],
  filters: Array<FilterDefinition<Filter>>
): FilterIssue[] {
  const issues: FilterIssue[] = rejected.map(({ key, renamed }) => {
    if (key === null) {
      return { key, reason: 'unclosedQuote' };
    }
    return renamed ? { key, reason: 'renamed', ...renamed } : { key, reason: 'invalid' };
  });

  // The title text search treats these as wildcards, which the rule search refuses.
  if (filter.text.some((word) => /[*%]/.test(word))) {
    issues.push({ key: null, reason: 'wildcardInText' });
  }

  for (const { key, feedback } of filters) {
    const reason = feedback?.(filter);
    if (reason) {
      issues.push({ key, reason });
    }
  }

  return issues;
}
