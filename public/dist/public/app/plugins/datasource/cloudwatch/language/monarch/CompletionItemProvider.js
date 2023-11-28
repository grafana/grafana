import { __awaiter } from "tslib";
import { getTemplateSrv } from '@grafana/runtime';
import { linkedTokenBuilder } from './linkedTokenBuilder';
import { StatementPosition } from './types';
/*
CompletionItemProvider is an extendable class which needs to implement :
- tokenTypes
- getStatementPosition
- getSuggestionKinds
- getSuggestions
*/
export class CompletionItemProvider {
    constructor(resources, templateSrv = getTemplateSrv()) {
        this.resources = resources;
        this.templateSrv = templateSrv;
        this.templateSrv = templateSrv;
        // implement with more specific tokens when extending this class
        this.tokenTypes = {
            Parenthesis: 'delimiter.parenthesis',
            Whitespace: 'white',
            Keyword: 'keyword',
            Delimiter: 'delimiter',
            Operator: 'operator',
            Identifier: 'identifier',
            Type: 'type',
            Function: 'predefined',
            Number: 'number',
            String: 'string',
            Variable: 'variable',
            Comment: 'comment',
            Regexp: 'regexp',
        };
    }
    // implemented by subclasses, given a token, returns a lexical position in a query
    getStatementPosition(currentToken) {
        return StatementPosition.Unknown;
    }
    // implemented by subclasses, given a lexical statement position, returns potential kinds of suggestions
    getSuggestionKinds(position) {
        return [];
    }
    // implemented by subclasses, given potential suggestions kinds, returns suggestion objects for monaco aka "CompletionItem"
    getSuggestions(monaco, currentToken, suggestionKinds, statementPosition, position) {
        return Promise.reject([]);
    }
    // called by registerLanguage and passed to monaco with registerCompletionItemProvider
    // returns an object that implements https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItemProvider.html
    getCompletionProvider(monaco, languageDefinition) {
        return {
            triggerCharacters: [' ', '$', ',', '(', "'"],
            provideCompletionItems: (model, position) => __awaiter(this, void 0, void 0, function* () {
                const currentToken = linkedTokenBuilder(monaco, languageDefinition, model, position, this.tokenTypes);
                const statementPosition = this.getStatementPosition(currentToken);
                const suggestionKinds = this.getSuggestionKinds(statementPosition);
                const suggestions = yield this.getSuggestions(monaco, currentToken, suggestionKinds, statementPosition, position);
                return {
                    suggestions,
                };
            }),
        };
    }
}
//# sourceMappingURL=CompletionItemProvider.js.map