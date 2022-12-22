import {
  getStandardSQLCompletionProvider,
  LanguageCompletionProvider,
  TableDefinition,
  TableIdentifier,
} from '@grafana/experimental';

interface CompletionProviderGetterArgs {
  getMeta: React.MutableRefObject<(t?: TableIdentifier) => Promise<TableDefinition[]>>;
}

export const getSqlCompletionProvider: (args: CompletionProviderGetterArgs) => LanguageCompletionProvider =
  ({ getMeta }) =>
  (monaco, language) => ({
    ...(language && getStandardSQLCompletionProvider(monaco, language)),
    tables: {
      resolve: getMeta.current,
    },
    columns: {
      resolve: getMeta.current,
    },
  });
