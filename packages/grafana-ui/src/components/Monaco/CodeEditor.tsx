import React from 'react';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { CodeEditorProps } from './types';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import ReactMonaco from 'react-monaco-editor';

function createDependencyProposals(range: any): monaco.languages.CompletionItem[] {
  // returning a static list of proposals, not even looking at the prefix (filtering is done by the Monaco editor),
  // here you could do a server side lookup
  return [
    {
      label: '${__field.name} (value)',
      kind: monaco.languages.CompletionItemKind.Value,
      documentation: 'The field value name (...)',
      insertText: '${__field.name}',
      detail: 'Keword detail',
      range: range,
    },
    {
      label: '${__field.name} (Text)',
      kind: monaco.languages.CompletionItemKind.Text,
      documentation: 'The field value name (...)',
      insertText: '${__field.name}',
      range: range,
    },
    {
      label: '${__field.name} (Field)',
      kind: monaco.languages.CompletionItemKind.Field,
      documentation: 'The field value name (...)',
      insertText: '${__field.name}',
      detail: 'Keword detail',
      range: range,
    },
    {
      label: '${__field.name} (Property)',
      kind: monaco.languages.CompletionItemKind.Property,
      documentation: 'The field value name (...)',
      insertText: '${__field.name}',
      detail: 'Keword detail',
      range: range,
    },
    {
      label: '${__field.name} (Function)',
      kind: monaco.languages.CompletionItemKind.Function,
      documentation: 'The field value name (...)',
      insertText: '${__field.name}',
      range: range,
      detail: 'Keword detail',
    },
  ];
}
function registerXXXX(language: string): monaco.IDisposable {
  console.log('registerCompletionItemProvider', language);
  return monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ['$'],

    provideCompletionItems: (model, position, context) => {
      if (context.triggerCharacter === '$') {
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - 1,
          endColumn: position.column,
        };
        return {
          suggestions: createDependencyProposals(range),
        };
      }

      // find out if we are completing a property in the 'dependencies' object.
      const lineText = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const idx = lineText.lastIndexOf('$');
      if (idx >= 0) {
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: idx, // the last $ we found
          endColumn: position.column,
        };
        console.log('$$$', lineText.substr(idx), idx, range);
        return {
          suggestions: createDependencyProposals(range),
        };
      }
      //      context.triggerKind === monaco.languages.CompletionTriggerKind.Invoke
      console.log('complete', lineText, context);
      return undefined;
    },
  });
}

type Props = CodeEditorProps & Themeable;

class UnthemedCodeEditor extends React.PureComponent<Props> {
  completionCancel?: monaco.IDisposable;

  componentWillUnmount() {
    if (this.completionCancel) {
      console.log('dispose of the custom completion stuff');
      this.completionCancel.dispose();
    }
  }

  getEditorValue = () => '';

  onBlur = () => {
    const { onBlur } = this.props;
    if (onBlur) {
      onBlur(this.getEditorValue());
    }
  };

  editorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    const { onSave, onEditorDidMount } = this.props;

    this.getEditorValue = () => editor.getValue();

    if (onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, () => {
        onSave(this.getEditorValue());
      });
    }

    if (onEditorDidMount) {
      onEditorDidMount(editor);
    }

    if (true) {
      this.completionCancel = registerXXXX(this.props.language);
    }
  };

  render() {
    const { theme, language, width, height, showMiniMap, readOnly } = this.props;
    const value = this.props.value ?? '';
    const longText = value.length > 100;

    return (
      <div onBlur={this.onBlur}>
        <ReactMonaco
          width={width}
          height={height}
          language={language}
          theme={theme.isDark ? 'vs-dark' : 'vs-light'}
          value={value}
          options={{
            wordWrap: 'off',
            codeLens: false, // not included in the bundle
            minimap: {
              enabled: longText && showMiniMap,
              renderCharacters: false,
            },
            readOnly,
            lineNumbersMinChars: 4,
            lineDecorationsWidth: 0,
            overviewRulerBorder: false,
            automaticLayout: true,
          }}
          editorDidMount={this.editorDidMount}
        />
      </div>
    );
  }
}

export default withTheme(UnthemedCodeEditor);
