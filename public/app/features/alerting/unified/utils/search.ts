import { RulesFilter } from '../search/rulesSearchParser';

export function getFilter(filter: Partial<RulesFilter>): RulesFilter {
  return {
    freeFormWords: [],
    labels: [],
    ...filter,
  };
}
