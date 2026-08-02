import { css } from '@emotion/css';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, CodeEditor, IconButton, Select, useStyles2 } from '@grafana/ui';

const LINE_HEIGHT = 18;
const MIN_LINES = 3;
const MAX_LINES = 30;

const LANGUAGES: Array<SelectableValue<string>> = [
  { label: 'Plain text', value: '' },
  { label: 'SQL', value: 'sql' },
  { label: 'PromQL', value: 'promql' },
  { label: 'LogQL', value: 'logql' },
  { label: 'JSON', value: 'json' },
  { label: 'YAML', value: 'yaml' },
  { label: 'Python', value: 'python' },
  { label: 'Go', value: 'go' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Shell', value: 'shell' },
];

interface Props {
  code: string;
  language: string;
  editing: boolean;
  onStartEdit: () => void;
  onChange: (changes: { code?: string; language?: string }) => void;
  onDone: () => void;
}

/**
 * Code block with the same interaction model as text blocks: a quiet preview that
 * switches to the Monaco editor (plus language picker) on click, and exits via the
 * check button or clicking away.
 */
export function CodeCellEditor({ code, language, editing, onStartEdit, onChange, onDone }: Props) {
  const styles = useStyles2(getStyles);
  const lines = code.split('\n').length;
  const height = Math.min(Math.max(lines + 1, MIN_LINES), MAX_LINES) * LINE_HEIGHT;

  if (!editing) {
    const languageLabel = LANGUAGES.find((option) => option.value === language)?.label ?? language;

    return (
      <div
        role="button"
        tabIndex={0}
        className={styles.preview}
        onClick={onStartEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onStartEdit();
          }
        }}
        aria-label={t('notebooks.code-cell.edit-label', 'Edit code block')}
        data-testid="notebook-code-preview"
      >
        {language && (
          <span className={styles.languageBadge}>
            <Badge text={languageLabel} color="darkgrey" />
          </span>
        )}
        {code.trim() ? (
          <pre className={styles.pre}>{code}</pre>
        ) : (
          <span className={styles.placeholder}>
            <Trans i18nKey="notebooks.code-cell.empty">Click to add code — a query, a command, a config snippet…</Trans>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Select
          width={20}
          options={LANGUAGES}
          value={language}
          onChange={(v) => onChange({ language: v.value ?? '' })}
          aria-label={t('notebooks.code-cell.language', 'Code language')}
          allowCustomValue
        />
        <IconButton
          name="check"
          size="lg"
          tooltip={t('notebooks.code-cell.done', 'Done editing')}
          onClick={onDone}
          data-testid="notebook-code-done"
        />
      </div>
      <CodeEditor
        value={code}
        language={language || 'plaintext'}
        height={height}
        width="100%"
        showLineNumbers
        onChange={(value) => onChange({ code: value })}
        onBlur={(value) => {
          onChange({ code: value });
          onDone();
        }}
        onEditorDidMount={(editor) => editor.focus()}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  header: css({
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  preview: css({
    position: 'relative',
    cursor: 'text',
    width: '100%',
    textAlign: 'left',
    padding: 0,

    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: 2,
    },
  }),
  pre: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1.5),
    fontSize: theme.typography.bodySmall.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
    overflow: 'auto',
    maxHeight: MAX_LINES * LINE_HEIGHT,
    margin: 0,
  }),
  languageBadge: css({
    position: 'absolute',
    top: theme.spacing(0.75),
    right: theme.spacing(0.75),
    zIndex: 1,
    opacity: 0.85,
  }),
  placeholder: css({
    display: 'block',
    color: theme.colors.text.disabled,
    fontStyle: 'italic',
    padding: theme.spacing(0.5, 0),
  }),
});
