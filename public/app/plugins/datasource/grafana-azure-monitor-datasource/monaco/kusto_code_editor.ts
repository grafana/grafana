// tslint:disable-next-line:no-reference
///<reference path="../../../../../../node_modules/monaco-editor/monaco.d.ts" />

import _ from 'lodash';

export interface SuggestionController {
  _model: any;
}

export default class KustoCodeEditor {
  codeEditor: monaco.editor.IStandaloneCodeEditor;
  completionItemProvider: monaco.IDisposable;
  signatureHelpProvider: monaco.IDisposable;

  splitWithNewLineRegex = /[^\n]+\n?|\n/g;
  newLineRegex = /\r?\n/;
  startsWithKustoPipeRegex = /^\|\s*/g;
  kustoPipeRegexStrict = /^\|\s*$/g;

  constructor(
    private containerDiv: any,
    private defaultTimeField: string,
    private getSchema: () => any,
    private config: any
  ) {}

  initMonaco(scope) {
    const themeName = this.config.bootData.user.lightTheme ? 'grafana-light' : 'vs-dark';

    monaco.editor.defineTheme('grafana-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000' },
        { token: 'variable.predefined', foreground: '800080' },
        { token: 'function', foreground: '0000FF' },
        { token: 'operator.sql', foreground: 'FF4500' },
        { token: 'string', foreground: 'B22222' },
        { token: 'operator.scss', foreground: '0000FF' },
        { token: 'variable', foreground: 'C71585' },
        { token: 'variable.parameter', foreground: '9932CC' },
        { token: '', foreground: '000000' },
        { token: 'type', foreground: '0000FF' },
        { token: 'tag', foreground: '0000FF' },
        { token: 'annotation', foreground: '2B91AF' },
        { token: 'keyword', foreground: '0000FF' },
        { token: 'number', foreground: '191970' },
        { token: 'annotation', foreground: '9400D3' },
        { token: 'invalid', background: 'cd3131' },
      ],
      colors: {
        'textCodeBlock.background': '#FFFFFF',
      },
    });

    monaco.languages['kusto'].kustoDefaults.setLanguageSettings({
      includeControlCommands: true,
      newlineAfterPipe: true,
      useIntellisenseV2: false,
    });

    this.codeEditor = monaco.editor.create(this.containerDiv, {
      value: scope.content || 'Write your query here',
      language: 'kusto',
      selectionHighlight: false,
      theme: themeName,
      folding: true,
      lineNumbers: 'off',
      lineHeight: 16,
      suggestFontSize: 13,
      dragAndDrop: false,
      occurrencesHighlight: false,
      minimap: {
        enabled: false,
      },
      renderIndentGuides: false,
      wordWrap: 'on',
    });
    this.codeEditor.layout();

    if (monaco.editor.getModels().length === 1) {
      this.completionItemProvider = monaco.languages.registerCompletionItemProvider('kusto', {
        triggerCharacters: ['.', ' '],
        provideCompletionItems: this.getCompletionItems.bind(this),
      });

      this.signatureHelpProvider = monaco.languages.registerSignatureHelpProvider('kusto', {
        signatureHelpTriggerCharacters: ['(', ')'],
        provideSignatureHelp: this.getSignatureHelp.bind(this),
      });
    }

    this.codeEditor.createContextKey('readyToExecute', true);

    this.codeEditor.onDidChangeCursorSelection(event => {
      this.onDidChangeCursorSelection(event);
    });

    this.getSchema().then(schema => {
      if (!schema) {
        return;
      }

      monaco.languages['kusto'].getKustoWorker().then(workerAccessor => {
        const model = this.codeEditor.getModel();
        if (!model) {
          return;
        }

        workerAccessor(model.uri).then(worker => {
          const dbName = Object.keys(schema.Databases).length > 0 ? Object.keys(schema.Databases)[0] : '';
          worker.setSchemaFromShowSchema(schema, 'https://help.kusto.windows.net', dbName);
          this.codeEditor.layout();
        });
      });
    });
  }

  setOnDidChangeModelContent(listener) {
    this.codeEditor.onDidChangeModelContent(listener);
  }

  disposeMonaco() {
    if (this.completionItemProvider) {
      try {
        this.completionItemProvider.dispose();
      } catch (e) {
        console.error('Failed to dispose the completion item provider.', e);
      }
    }
    if (this.signatureHelpProvider) {
      try {
        this.signatureHelpProvider.dispose();
      } catch (e) {
        console.error('Failed to dispose the signature help provider.', e);
      }
    }
    if (this.codeEditor) {
      try {
        this.codeEditor.dispose();
      } catch (e) {
        console.error('Failed to dispose the editor component.', e);
      }
    }
  }

  addCommand(keybinding: number, commandFunc: monaco.editor.ICommandHandler) {
    this.codeEditor.addCommand(keybinding, commandFunc, 'readyToExecute');
  }

  getValue() {
    return this.codeEditor.getValue();
  }

  toSuggestionController(srv: monaco.editor.IEditorContribution): SuggestionController {
    return srv as any;
  }

  setEditorContent(value) {
    this.codeEditor.setValue(value);
  }

  getCompletionItems(model: monaco.editor.IReadOnlyModel, position: monaco.Position) {
    const timeFilterDocs =
      '##### Macro that uses the selected timerange in Grafana to filter the query.\n\n' +
      '- `$__timeFilter()` -> Uses the ' +
      this.defaultTimeField +
      ' column\n\n' +
      '- `$__timeFilter(datetimeColumn)` ->  Uses the specified datetime column to build the query.';

    const textUntilPosition = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    if (!_.includes(textUntilPosition, '|')) {
      return [];
    }

    if (!_.includes(textUntilPosition.toLowerCase(), 'where')) {
      return [
        {
          label: 'where $__timeFilter(timeColumn)',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: {
            value: 'where \\$__timeFilter(${0:' + this.defaultTimeField + '})',
          },
          documentation: {
            value: timeFilterDocs,
          },
        },
      ];
    }

    if (_.includes(model.getLineContent(position.lineNumber).toLowerCase(), 'where')) {
      return [
        {
          label: '$__timeFilter(timeColumn)',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: {
            value: '\\$__timeFilter(${0:' + this.defaultTimeField + '})',
          },
          documentation: {
            value: timeFilterDocs,
          },
        },
        {
          label: '$__from',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: {
            value: `\\$__from`,
          },
          documentation: {
            value:
              'Built-in variable that returns the from value of the selected timerange in Grafana.\n\n' +
              'Example: `where ' +
              this.defaultTimeField +
              ' > $__from` ',
          },
        },
        {
          label: '$__to',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: {
            value: `\\$__to`,
          },
          documentation: {
            value:
              'Built-in variable that returns the to value of the selected timerange in Grafana.\n\n' +
              'Example: `where ' +
              this.defaultTimeField +
              ' < $__to` ',
          },
        },
        {
          label: '$__interval',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: {
            value: `\\$__interval`,
          },
          documentation: {
            value:
              '##### Built-in variable that returns an automatic time grain suitable for the current timerange.\n\n' +
              'Used with the bin() function - `bin(' +
              this.defaultTimeField +
              ', $__interval)` \n\n' +
              '[Grafana docs](http://docs.grafana.org/reference/templating/#the-interval-variable)',
          },
        },
      ];
    }

    return [];
  }

  getSignatureHelp(model: monaco.editor.IReadOnlyModel, position: monaco.Position, token: monaco.CancellationToken) {
    const textUntilPosition = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: position.column - 14,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    if (textUntilPosition !== '$__timeFilter(') {
      return {} as monaco.languages.SignatureHelp;
    }

    const signature: monaco.languages.SignatureHelp = {
      activeParameter: 0,
      activeSignature: 0,
      signatures: [
        {
          label: '$__timeFilter(timeColumn)',
          parameters: [
            {
              label: 'timeColumn',
              documentation:
                'Default is ' +
                this.defaultTimeField +
                ' column. Datetime column to filter data using the selected date range. ',
            },
          ],
        },
      ],
    };

    return signature;
  }

  onDidChangeCursorSelection(event) {
    if (event.source !== 'modelChange' || event.reason !== monaco.editor.CursorChangeReason.RecoverFromMarkers) {
      return;
    }
    const lastChar = this.getCharAt(event.selection.positionLineNumber, event.selection.positionColumn - 1);

    if (lastChar !== ' ') {
      return;
    }

    this.triggerSuggestions();
  }

  triggerSuggestions() {
    const suggestController = this.codeEditor.getContribution('editor.contrib.suggestController');
    if (!suggestController) {
      return;
    }

    const convertedController = this.toSuggestionController(suggestController);

    convertedController._model.cancel();
    setTimeout(() => {
      convertedController._model.trigger(true);
    }, 10);
  }

  getCharAt(lineNumber: number, column: number) {
    const model = this.codeEditor.getModel();
    if (model.getLineCount() === 0 || model.getLineCount() < lineNumber) {
      return '';
    }
    const line = model.getLineContent(lineNumber);
    if (line.length < column || column < 1) {
      return '';
    }
    return line[column - 1];
  }
}
