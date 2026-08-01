import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TextArea, useStyles2 } from '@grafana/ui';
import { MarkdownCell } from 'app/features/dashboard-scene/scene/layout-notebook/cells/MarkdownCell';

interface Props {
  value: string;
  editing: boolean;
  onStartEdit: () => void;
  onChange: (text: string) => void;
  onDone: () => void;
}

/**
 * Notion-style markdown cell: rendered preview that switches to a textarea on
 * click, committing on blur / Escape / mod+Enter. Preview rendering reuses the
 * read-only notebook MarkdownCell (sanitized markdown).
 */
export function MarkdownCellEditor({ value, editing, onStartEdit, onChange, onDone }: Props) {
  const styles = useStyles2(getStyles);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Put the caret at the end rather than selecting everything.
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [editing]);

  if (editing) {
    const rows = Math.min(Math.max(value.split('\n').length + 1, 3), 30);
    return (
      <TextArea
        ref={textareaRef}
        value={value}
        rows={rows}
        placeholder={t('notebooks.markdown-cell.placeholder', 'Write markdown…')}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={onDone}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            onDone();
          }
        }}
        className={styles.textarea}
        data-testid="notebook-markdown-input"
      />
    );
  }

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
      aria-label={t('notebooks.markdown-cell.edit-label', 'Edit text cell')}
      data-testid="notebook-markdown-preview"
    >
      {value.trim() ? (
        <MarkdownCell content={{ kind: 'Markdown', spec: { text: value } }} />
      ) : (
        <span className={styles.placeholder}>
          {t('notebooks.markdown-cell.empty', 'Click to add text — markdown, links and images supported')}
        </span>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  textarea: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  preview: css({
    cursor: 'text',
    width: '100%',
    textAlign: 'left',
    padding: theme.spacing(0.5, 0),

    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: 2,
    },
  }),
  placeholder: css({
    color: theme.colors.text.disabled,
    fontStyle: 'italic',
  }),
});
