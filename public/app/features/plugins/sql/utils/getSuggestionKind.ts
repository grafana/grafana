import { Registry } from '@grafana/data';

import { SuggestionKindRegistryItem } from '../standardSql/suggestionsKindRegistry';
import { StatementPosition, SuggestionKind } from '../types';

/**
 * Given statement positions, returns list of suggestion kinds that apply to those positions.
 */
export function getSuggestionKinds(
  statementPosition: StatementPosition[],
  suggestionsKindRegistry: Registry<SuggestionKindRegistryItem>
): SuggestionKind[] {
  let result: SuggestionKind[] = [];
  for (let i = 0; i < statementPosition.length; i++) {
    const exists = suggestionsKindRegistry.getIfExists(statementPosition[i]);
    if (exists) {
      result = result.concat(exists.kind);
    }
  }

  return result;
}
