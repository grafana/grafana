import type { Monaco, monacoTypes } from '@grafana/ui';
import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import { CloudWatchDatasource } from '../datasource';
import { linkedTokenBuilder } from './linkedTokenBuilder';

import { LinkedToken } from './LinkedToken';
import { LanguageDefinition } from './register';
import { StatementPosition, SuggestionKind, TokenType } from './types';

type CompletionItem = monacoTypes.languages.CompletionItem;

/*
CompletionItemProvider is an extendable class which takes in:
- a datasource
- a templateSrv for fetching template variables
- a language definition
- the tokentype classes for that language
- a function for determining the syntactical position of a current token
- a function for determining the potential suggestions available for a given syntactical position

In return the provider will create a "completionProvider" that when called will return the correct suggestions
When extending this class please implement your own version of getSuggestions
*/
export class CompletionItemProvider {
  region: string;
  templateVariables: string[];
  datasource: CloudWatchDatasource;
  templateSrv: TemplateSrv;

  constructor(
    datasource: CloudWatchDatasource,
    templateSrv: TemplateSrv = getTemplateSrv(),
    private languageDefinition: LanguageDefinition,
    private tokenTypes: TokenType,
    private getStatementPosition: (currentToken: LinkedToken | null) => StatementPosition,
    private getSuggestionKinds: (position: StatementPosition) => SuggestionKind[]
  ) {
    this.datasource = datasource;
    this.templateSrv = templateSrv;
    this.templateVariables = this.datasource.getVariables();
    this.region = datasource.getActualRegion();
    this.templateSrv = templateSrv;
    this.getSuggestionKinds = getSuggestionKinds;
    this.getStatementPosition = getStatementPosition;
  }

  // Only used by SQL for now, in the future this could be removed or made more generic
  setRegion(region: string) {
    this.region = region;
  }

  // called by registerLanguage and passed to monaco with registerCompletionItemProvider
  // returns an object that implements https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItemProvider.html
  getCompletionProvider(monaco: Monaco) {
    return {
      triggerCharacters: [' ', '$', ',', '(', "'"], // one of these characters indicates that it is time to look for a suggestion
      provideCompletionItems: async (model: monacoTypes.editor.ITextModel, position: monacoTypes.IPosition) => {
        const currentToken = linkedTokenBuilder(monaco, this.languageDefinition, model, position, this.tokenTypes); // describes the current thing and what's next
        const statementPosition = this.getStatementPosition(currentToken);
        const suggestionKinds = this.getSuggestionKinds(statementPosition);

        const suggestions = await this.getSuggestions(
          monaco,
          currentToken,
          suggestionKinds,
          statementPosition,
          position
        );

        return {
          suggestions,
        };
      },
    };
  }

  // implemented by those that extend it
  getSuggestions(
    monaco: Monaco,
    currentToken: LinkedToken | null,
    suggestionKinds: SuggestionKind[],
    statementPosition: StatementPosition,
    position: monacoTypes.IPosition
  ): Promise<CompletionItem[]> {
    return Promise.reject([]);
  }
}
