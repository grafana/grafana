import React from 'react';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import Editor from '@monaco-editor/react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { checkSetup } from './setup';

// ??? Can we only import types?
// import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
// import { KeyCode, KeyMod } from 'monaco-editor/esm/vs/editor/editor.api';

export interface Props extends Themeable {
  text: string;

  language: string;

  readOnly?: boolean;

  /** only called onblur */
  onChange: (text: string) => void;
}

class UnthemedCodeEditor extends React.PureComponent<Props> {
  constructor(props: Props) {
    super(props);
    checkSetup();
  }

  getEditorValue = () => '';

  onBlur = () => {
    const val = this.getEditorValue();
    this.props.onChange(val);
  };

  onEditorDidMount = (getEditorValue: () => string, editor: any) => {
    this.getEditorValue = getEditorValue;

    // Listen for save command
    console.log('Register save commnad!!!', editor);
    // editor.addCommand(KeyMod.CtrlCmd | KeyCode.KEY_S, () => {
    //   console.log('SAVE pressed!');
    // });
  };

  render() {
    const { text, theme, language } = this.props;

    return (
      <AutoSizer disableWidth>
        {({ height }) => (
          <div onBlur={this.onBlur}>
            <Editor
              height={height}
              language={language}
              value={text}
              editorDidMount={this.onEditorDidMount}
              theme={theme.isDark ? 'dark' : 'light'}
              options={{
                wordWrap: 'off',
                codeLens: false, // too small to bother
                minimap: {
                  enabled: false,
                  renderCharacters: false,
                },
                readOnly: this.props.readOnly,
                lineNumbersMinChars: 4,
                lineDecorationsWidth: 0,
                overviewRulerBorder: false,
                automaticLayout: true,
              }}
            />
          </div>
        )}
      </AutoSizer>
    );
  }
}

export const CodeEditor = withTheme(UnthemedCodeEditor);
