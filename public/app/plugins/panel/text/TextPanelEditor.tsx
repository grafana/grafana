import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import {
  CodeEditor,
  useStyles2,
  CodeEditorSuggestionItem,
  variableSuggestionToCodeEditorSuggestion,
} from '@grafana/ui';

import { PanelOptions, TextMode } from './panelcfg.gen';

export const TextPanelEditor = ({ value, onChange, context }: StandardEditorProps<string, any, PanelOptions>) => {
  const language = useMemo(() => context.options?.mode ?? TextMode.Markdown, [context]);
  const styles = useStyles2(getStyles);

  const getSuggestions = (): CodeEditorSuggestionItem[] => {
    if (!context.getSuggestions) {
      return [];
    }
    return context.getSuggestions().map((v) => variableSuggestionToCodeEditorSuggestion(v));
  };

  return (
    <div className={cx(styles.editorBox)}>
      <AutoSizer disableHeight>
        {({ width }) => {
          if (width === 0) {
            return null;
          }
          return (
            <CodeEditor
              value={value}
              onBlur={onChange}
              onSave={onChange}
              language={language}
              width={width}
              showMiniMap={false}
              showLineNumbers={false}
              height="500px"
              getSuggestions={getSuggestions}
            />
          );
        }}
      </AutoSizer>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  editorBox: css`
    label: editorBox;
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.borderRadius(1)};
    margin: ${theme.spacing(0.5)} 0;
    width: 100%;
  `,
});
