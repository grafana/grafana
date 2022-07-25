import { Registry } from '@grafana/data';

import { SuggestionKindRegistryItem } from '../standardSql/suggestionsKindRegistry';
import { StatementPosition, SuggestionKind } from '../types';

import { getSuggestionKinds } from './getSuggestionKind';

describe('getSuggestionKind', () => {
  const registry = new Registry((): SuggestionKindRegistryItem[] => {
    return [
      {
        id: StatementPosition.SelectKeyword,
        name: StatementPosition.SelectKeyword,
        kind: [SuggestionKind.SelectKeyword],
      },
      {
        id: StatementPosition.AfterSelectArguments,
        name: StatementPosition.AfterSelectArguments,
        kind: [SuggestionKind.Columns],
      },
    ];
  });
  it('should return select kind when given select keyword as position', () => {
    const pos = [StatementPosition.SelectKeyword];
    expect([SuggestionKind.SelectKeyword]).toEqual(getSuggestionKinds(pos, registry));
  });
  it('should return column kind when given AfterSelectArguments as position', () => {
    const pos = [StatementPosition.AfterSelectArguments];
    expect([SuggestionKind.Columns]).toEqual(getSuggestionKinds(pos, registry));
  });
});
