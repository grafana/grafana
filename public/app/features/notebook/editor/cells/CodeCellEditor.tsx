import { css } from '@emotion/css';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { CodeEditor, Select, useStyles2 } from '@grafana/ui';

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
  onChange: (changes: { code?: string; language?: string }) => void;
}

export function CodeCellEditor({ code, language, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const lines = code.split('\n').length;
  const height = Math.min(Math.max(lines + 1, MIN_LINES), MAX_LINES) * LINE_HEIGHT;

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
      </div>
      <CodeEditor
        value={code}
        language={language || 'plaintext'}
        height={height}
        width="100%"
        showLineNumbers
        onChange={(value) => onChange({ code: value })}
        onBlur={(value) => onChange({ code: value })}
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
  }),
});
