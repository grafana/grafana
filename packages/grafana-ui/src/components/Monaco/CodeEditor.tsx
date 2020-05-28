import React from 'react';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import Editor from '@monaco-editor/react';
import AutoSizer from 'react-virtualized-auto-sizer';

export interface Props extends Themeable {
  text: string;

  language: string;

  readOnly?: boolean;

  /** only called onblur */
  onChange: (text: string) => void;
}

class UnthemedCodeEditor extends React.PureComponent<Props> {
  getEditorValue: any | undefined;

  onBlur = () => {
    const val = this.getEditorValue();
    this.props.onChange(val);
  };

  onEditorDidMount = (getEditorValue: any) => {
    this.getEditorValue = getEditorValue;
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
