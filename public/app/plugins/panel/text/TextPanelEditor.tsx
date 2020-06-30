import React, { FC, useMemo } from 'react';
import { css, cx } from 'emotion';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  CodeEditor,
  stylesFactory,
  useTheme,
  CodeEditorSuggestionItem,
  CodeEditorSuggestionItemKind,
} from '@grafana/ui';
import { GrafanaTheme, StandardEditorProps } from '@grafana/data';

import { TextOptions } from './types';

const currentTemplateValues = (): CodeEditorSuggestionItem[] => {
  return [
    {
      label: '${__field.nameM}',
      kind: CodeEditorSuggestionItemKind.Method,
      detail: 'Method detail',
    },
    {
      label: '${__field.nameF}',
      kind: CodeEditorSuggestionItemKind.Field,
      detail: 'Field detail',
    },
    {
      label: '${__field.nameP}',
      kind: CodeEditorSuggestionItemKind.Property,
      detail: 'Property detail',
    },
    {
      label: '${__field.nameC}',
      kind: CodeEditorSuggestionItemKind.Constant,
      detail: 'Constant detail',
    },
    {
      label: '${__field.nameT}',
      kind: CodeEditorSuggestionItemKind.Text,
      detail: 'Text detail',
    },
  ];
};

export const TextPanelEditor: FC<StandardEditorProps<string, any, TextOptions>> = ({ value, onChange, context }) => {
  const language = useMemo(() => context.options?.mode ?? 'markdown', [context]);
  const theme = useTheme();
  const styles = getStyles(theme);
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
              height="200px"
              getSuggestions={currentTemplateValues}
            />
          );
        }}
      </AutoSizer>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  editorBox: css`
    label: editorBox;
    border: ${theme.border.width.sm} solid ${theme.colors.border2};
    border-radius: ${theme.border.radius.sm};
    margin: ${theme.spacing.xs} 0;
    width: 100%;
  `,
}));
