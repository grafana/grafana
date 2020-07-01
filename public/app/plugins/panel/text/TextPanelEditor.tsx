import React, { FC, useMemo } from 'react';
import { css, cx } from 'emotion';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  CodeEditor,
  stylesFactory,
  useTheme,
  CodeEditorSuggestionItem,
  CodeEditorSuggestionItemKind,
  variableSuggestionToCodeEditorSuggestion,
} from '@grafana/ui';
import { GrafanaTheme, StandardEditorProps, VariableSuggestionsScope } from '@grafana/data';

import { TextOptions } from './types';

export const TextPanelEditor: FC<StandardEditorProps<string, any, TextOptions>> = ({ value, onChange, context }) => {
  const language = useMemo(() => context.options?.mode ?? 'markdown', [context]);
  const theme = useTheme();
  const styles = getStyles(theme);

  const getSuggestions = (): CodeEditorSuggestionItem[] => {
    const vars = context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : [];
    const items = vars.map(v => variableSuggestionToCodeEditorSuggestion(v, context.replaceVariables));
    items.push({
      label: '$__timeRange',
      kind: CodeEditorSuggestionItemKind.Method,
      detail: 'time range macro',
      documentation: 'Expands to a full query...',
    });
    items.push({
      label: '${__field.name}',
      kind: CodeEditorSuggestionItemKind.Field,
      detail: 'Field name',
    });
    console.log('SUGGESTIONSitem', context.getSuggestions);
    return items;
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
              height="200px"
              getSuggestions={getSuggestions}
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
