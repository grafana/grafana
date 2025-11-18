import { RulesFilter } from '../../search/rulesSearchParser';

/**
 * Build title search parameter for backend filtering
 * Combines ruleName and freeFormWords into a single search string
 */
export function buildTitleSearch(filterState: RulesFilter): string | undefined {
  const titleParts: string[] = [];

  const ruleName = filterState.ruleName?.trim();
  if (ruleName) {
    titleParts.push(ruleName);
  }

  const freeFormSegment = filterState.freeFormWords
    .map((word) => word.trim())
    .filter(Boolean)
    .join(' ');

  if (freeFormSegment) {
    titleParts.push(freeFormSegment);
  }

  if (titleParts.length === 0) {
    return undefined;
  }

  return titleParts.join(' ');
}

/**
 * Normalize filter state for case-insensitive matching
 * Lowercase free form words, rule name, group name and namespace
 */
export function normalizeFilterState(filterState: RulesFilter): RulesFilter {
  return {
    ...filterState,
    freeFormWords: filterState.freeFormWords.map((word) => word.toLowerCase()),
    ruleName: filterState.ruleName?.toLowerCase(),
    groupName: filterState.groupName?.toLowerCase(),
    namespace: filterState.namespace?.toLowerCase(),
  };
}
