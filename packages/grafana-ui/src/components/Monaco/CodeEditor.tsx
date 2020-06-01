import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import AutoSizer from 'react-virtualized-auto-sizer';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useTheme } from '../../themes';
import { CodeEditorChangeHandler, useMonaco } from './useMonaco';

export enum CodeEditorLanguage {
  JSON = 'json',
  JavaScript = 'javascript',
}

interface CodeEditorProps {
  value: string;
  language: CodeEditorLanguage;
  readOnly?: boolean;
  /** Handler to be performed on any change in the editor */
  onChange?: CodeEditorChangeHandler;
  /** Handler to be performed when editor is blurred */
  onBlur?: CodeEditorChangeHandler;
  /** Handler to be performed when Cmd/Ctrl+S is pressed */
  onSave?: CodeEditorChangeHandler;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, language, onChange, onBlur, onSave, readOnly }) => {
  const theme = useTheme();
  const { initializeEditor, getValue } = useMonaco({
    commands: {
      [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S]: () => {
        if (onSave) {
          onSave(getValue());
        }
      },
    },
    eventHandlers: {
      onBlur,
    },
  });

  return (
    <AutoSizer disableWidth>
      {({ height }) => (
        <MonacoEditor
          height={height}
          language={language}
          width="100%"
          theme={theme.isDark ? 'vs-dark' : 'vs-light'}
          value={value}
          options={{
            wordWrap: 'off',
            codeLens: false, // too small to bother (and not compiled)
            minimap: {
              enabled: value.length > 100,
              renderCharacters: false,
            },
            readOnly,
            lineNumbersMinChars: 4,
            lineDecorationsWidth: 0,
            overviewRulerBorder: false,
            automaticLayout: true,
          }}
          editorDidMount={initializeEditor}
          onChange={onChange}
        />
      )}
    </AutoSizer>
  );
};
