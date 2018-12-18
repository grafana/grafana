// tslint:disable-next-line:no-reference
///<reference path="../../../../../../node_modules/monaco-editor/monaco.d.ts" />

import KustoCodeEditor from './kusto_code_editor';
import _ from 'lodash';

describe('KustoCodeEditor', () => {
  let editor;

  describe('getCompletionItems', () => {
    let completionItems;
    let lineContent;
    let model;

    beforeEach(() => {
      (global as any).monaco = {
        languages: {
          CompletionItemKind: {
            Keyword: '',
          },
        },
      };
      model = {
        getLineCount: () => 3,
        getValueInRange: () => 'atable/n' + lineContent,
        getLineContent: () => lineContent,
      };

      const StandaloneMock = jest.fn<monaco.editor.ICodeEditor>();
      editor = new KustoCodeEditor(null, 'TimeGenerated', () => {}, {});
      editor.codeEditor = new StandaloneMock();
    });

    describe('when no where clause and no | in model text', () => {
      beforeEach(() => {
        lineContent = ' ';
        const position = { lineNumber: 2, column: 2 };
        completionItems = editor.getCompletionItems(model, position);
      });

      it('should not return any grafana macros', () => {
        expect(completionItems.length).toBe(0);
      });
    });

    describe('when no where clause in model text', () => {
      beforeEach(() => {
        lineContent = '| ';
        const position = { lineNumber: 2, column: 3 };
        completionItems = editor.getCompletionItems(model, position);
      });

      it('should return grafana macros for where and timefilter', () => {
        expect(completionItems.length).toBe(1);

        expect(completionItems[0].label).toBe('where $__timeFilter(timeColumn)');
        expect(completionItems[0].insertText.value).toBe('where \\$__timeFilter(${0:TimeGenerated})');
      });
    });

    describe('when on line with where clause', () => {
      beforeEach(() => {
        lineContent = '| where Test == 2 and ';
        const position = { lineNumber: 2, column: 23 };
        completionItems = editor.getCompletionItems(model, position);
      });

      it('should return grafana macros and variables', () => {
        expect(completionItems.length).toBe(4);

        expect(completionItems[0].label).toBe('$__timeFilter(timeColumn)');
        expect(completionItems[0].insertText.value).toBe('\\$__timeFilter(${0:TimeGenerated})');

        expect(completionItems[1].label).toBe('$__from');
        expect(completionItems[1].insertText.value).toBe('\\$__from');

        expect(completionItems[2].label).toBe('$__to');
        expect(completionItems[2].insertText.value).toBe('\\$__to');

        expect(completionItems[3].label).toBe('$__interval');
        expect(completionItems[3].insertText.value).toBe('\\$__interval');
      });
    });
  });

  describe('onDidChangeCursorSelection', () => {
    const keyboardEvent = {
      selection: {
        startLineNumber: 4,
        startColumn: 26,
        endLineNumber: 4,
        endColumn: 31,
        selectionStartLineNumber: 4,
        selectionStartColumn: 26,
        positionLineNumber: 4,
        positionColumn: 31,
      },
      secondarySelections: [],
      source: 'keyboard',
      reason: 3,
    };

    const modelChangedEvent = {
      selection: {
        startLineNumber: 2,
        startColumn: 1,
        endLineNumber: 3,
        endColumn: 3,
        selectionStartLineNumber: 2,
        selectionStartColumn: 1,
        positionLineNumber: 3,
        positionColumn: 3,
      },
      secondarySelections: [],
      source: 'modelChange',
      reason: 2,
    };

    describe('suggestion trigger', () => {
      let suggestionTriggered;
      let lineContent = '';

      beforeEach(() => {
        (global as any).monaco = {
          languages: {
            CompletionItemKind: {
              Keyword: '',
            },
          },
          editor: {
            CursorChangeReason: {
              NotSet: 0,
              ContentFlush: 1,
              RecoverFromMarkers: 2,
              Explicit: 3,
              Paste: 4,
              Undo: 5,
              Redo: 6,
            },
          },
        };
        const StandaloneMock = jest.fn<monaco.editor.ICodeEditor>(() => ({
          getModel: () => {
            return {
              getLineCount: () => 3,
              getLineContent: () => lineContent,
            };
          },
        }));

        editor = new KustoCodeEditor(null, 'TimeGenerated', () => {}, {});
        editor.codeEditor = new StandaloneMock();
        editor.triggerSuggestions = () => {
          suggestionTriggered = true;
        };
      });

      describe('when model change event, reason is RecoverFromMarkers and there is a space after', () => {
        beforeEach(() => {
          suggestionTriggered = false;
          lineContent = '| ';
          editor.onDidChangeCursorSelection(modelChangedEvent);
        });

        it('should trigger suggestion', () => {
          expect(suggestionTriggered).toBeTruthy();
        });
      });

      describe('when not model change event', () => {
        beforeEach(() => {
          suggestionTriggered = false;
          editor.onDidChangeCursorSelection(keyboardEvent);
        });

        it('should not trigger suggestion', () => {
          expect(suggestionTriggered).toBeFalsy();
        });
      });

      describe('when model change event but with incorrect reason', () => {
        beforeEach(() => {
          suggestionTriggered = false;
          const modelChangedWithInvalidReason = _.cloneDeep(modelChangedEvent);
          modelChangedWithInvalidReason.reason = 5;
          editor.onDidChangeCursorSelection(modelChangedWithInvalidReason);
        });

        it('should not trigger suggestion', () => {
          expect(suggestionTriggered).toBeFalsy();
        });
      });

      describe('when model change event but with no space after', () => {
        beforeEach(() => {
          suggestionTriggered = false;
          lineContent = '|';
          editor.onDidChangeCursorSelection(modelChangedEvent);
        });

        it('should not trigger suggestion', () => {
          expect(suggestionTriggered).toBeFalsy();
        });
      });

      describe('when model change event but with no space after', () => {
        beforeEach(() => {
          suggestionTriggered = false;
          lineContent = '|';
          editor.onDidChangeCursorSelection(modelChangedEvent);
        });

        it('should not trigger suggestion', () => {
          expect(suggestionTriggered).toBeFalsy();
        });
      });
    });
  });
});
