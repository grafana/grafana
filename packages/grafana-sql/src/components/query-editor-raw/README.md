## SQLEditor

### Core concepts

- `SuggestionKind` - a descriptive string representing a type of a suggestion, i.e. `SelectKeyword`, `Tables`, `LogicalOperators` etc.
- `LinkedToken` - linked list element representing each individual token with a query. Allows traversing the query back and forth. Used by `StatementPositionResolver`(see below)
- `StatementPosition` - a desctiptive string representing cursor/token position within the query. Each statement position is defined together with `StatementPositionResolver` that, given some position context, returns a boolean value indicating whether or not we are in a given `StatementPosition` position.
  ```ts
  export type StatementPositionResolver = (
    currentToken: LinkedToken | null,
    previousKeyword: LinkedToken | null,
    previousNonWhiteSpace: LinkedToken | null,
    previousIsSlash: Boolean // To be removed as it's CloudWatch specific
  ) => Boolean;
  ```
- `SuggestionKind` and `StatementPosition` are glued together via suggestions kind registry (language specific!). This registry contains items of `SuggestionKindRegistyItem` type of the following interface:
  ```ts
  export interface SuggestionKindRegistyItem extends RegistryItem {
    id: StatementPosition;
    kind: SuggestionKind[];
  }
  ```
  This item defines what kinds of suggestions should be provided in a given statement position
- Registries. There are couple of different registries used that drive the autocomplete mechanism.
  - **Language specific**: functions registry, operators registry, suggestion kinds registries and statement position resolvers registires. Those registires contain SQL defaults as well as allow extension per language type.
  - **Instance specific**: Registry of `SuggestionsRegistyItem` items that glue particular `SuggestionKind` with an async function that provides completion items for it.
    ```ts
    export interface SuggestionsRegistyItem extends RegistryItem {
      id: SuggestionKind;
      suggestions: (position: PositionContext, m: typeof monacoTypes) => Promise<CustomSuggestion[]>;
    }
    ```
    Think about instance-specific registry as having i.e. mixed data source with multiple query editors for the same type of data source and you wish to provide only table suggestions that are valid for particular query row.

### SQLEditor component

Goals

- [ ] Allow providing suggestions for standard-ish SQL syntax (THIS PR)
- [ ] Allow providing custom SQL dialects and suggestions for them (TODO - CloudWatch implementation sets a good base for how to provide custom dialect definition)

`SQLEditor` component builds on top of `CodeEditor` component, but we may want to base it on `ReactMonacoEditor` component instead to be less prone to `CodeEditor` API changes and have full control over the Monaco API. For now the `CodeEditor` is good enough for a simplification.

`SQLEditor` API:

```ts
interface SQLEditorProps {
  query: string;
  onChange: (q: string) => void;
  language?: LanguageDefinition;
}
```

The important part is the `LanguageDefinition` interface which provides way to customize the completion both on a language and instance level:

```ts
interface LanguageDefinition extends monacoTypes.languages.ILanguageExtensionPoint {
  // TODO: Will allow providing a custom language definition.
  loadLanguage?: (module: any) => Promise<void>;
  // Provides API for customizing the autocomplete
  completionProvider?: (m: Monaco) => SQLCompletionItemProvider;
}
```

The `completionProvider` function is the core of the autocomplete customization. `SQLEditor` comes with standard SQL completion items, but this function allows:

- providing dynamic suggestions: tables, columns
- providing custom `StatementPositionResolvers` that are specific for a given dialect or not implemented yet for standard SQL
- providing custom `SuggestionKind` and resolvers for this kind of suggestions.

```ts
export interface SQLCompletionItemProvider
  extends Omit<monacoTypes.languages.CompletionItemProvider, 'provideCompletionItems'> {
  /**
   * Allows dialect specific functions to be added to the completion list.
   * @alpha
   */
  supportedFunctions?: () => Array<{
    id: string;
    name: string;
  }>;

  /**
   * Allows dialect specific operators to be added to the completion list.
   * @alpha
   */
  supportedOperators?: () => Array<{
    id: string;
    operator: string;
    type: OperatorType;
  }>;

  /**
   * Allows adding macros that are available in the dialect datasource.
   * @alpha
   */
  supportedMacros?: () => Array<{
    id: string;
    name: string;
    type: MacroType;
    args: Array<string>;
  }>;

  /**
   * Allows custom suggestion kinds to be defined and correlate them with <Custom>StatementPosition.
   * @alpha
   */
  customSuggestionKinds?: () => CustomSuggestionKind[];

  /**
   * Allows custom statement placement definition.
   * @alpha
   */
  customStatementPlacement?: () => CustomStatementPlacement[];

  /**
   * Allows providing a custom function for resolving db tables.
   * It's up to the consumer to decide whether the columns are resolved via API calls or preloaded in the query editor(i.e. full db schema is preloades loaded).
   * @alpha
   */
  tables?: {
    resolve: () => Promise<TableDefinition[]>;
    // Allows providing a custom function for calculating the table name from the query. If not specified a default implemnentation is used. I.e. BigQuery requires the table name to be fully qualified name: <project>.<dataset>.<table>
    parseName?: (t: LinkedToken) => string;
  };
  /**
   * Allows providing a custom function for resolving table.
   * It's up to the consumer to decide whether the columns are resolved via API calls or preloaded in the query editor(i.e. full db schema is preloades loaded).
   * @alpha
   */
  columns?: {
    resolve: (table: string) => Promise<ColumnDefinition[]>;
  };
}
```
