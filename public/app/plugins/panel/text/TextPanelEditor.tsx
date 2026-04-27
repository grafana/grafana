import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import type { StandardEditorProps } from '@grafana/data/field';
import type { GrafanaTheme2 } from '@grafana/data/themes';
import { CodeEditor, type CodeEditorSuggestionItem, variableSuggestionToCodeEditorSuggestion } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { type Options, TextMode } from './panelcfg.gen';

export const TextPanelEditor = ({ value, onChange, context }: StandardEditorProps<string, {}, Options>) => {
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
      <CodeEditor
        value={value}
        onBlur={onChange}
        onSave={onChange}
        language={language}
        width="100%"
        showMiniMap={false}
        showLineNumbers={false}
        height="500px"
        getSuggestions={getSuggestions}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  editorBox: css({
    label: 'editorBox',
    margin: theme.spacing(0.5, 0),
    width: '100%',
  }),
});
