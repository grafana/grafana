import { css } from '@emotion/css';
import { memo, useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes/ThemeContext';
import { CodeMirrorEditor } from '../CodeMirror/CodeEditorLazy';
import { getQueryFieldConfig } from '../QueryFieldConfig/queryFieldConfig';

export interface QueryInputProps {
  /** Current query text. */
  value: string;
  /** Called whenever the query text changes. */
  onChange: (value: string) => void;
  /** Called when the user presses Shift+Enter or Ctrl+Enter. */
  onRunQuery?: () => void;
  /** Called when the input loses focus. */
  onBlur?: () => void;
  /** Placeholder shown while the input is empty. */
  placeholder?: string;
  /** Accessible label applied to the query input. */
  'aria-label'?: string;
  /** Accessible label reference applied to the query input. */
  'aria-labelledby'?: string;
}

const styles = {
  wrapper: css({
    width: '100%',
  }),
};

/**
 * A controlled query input backed by CodeMirror. Long queries wrap, plain Enter
 * inserts a newline, and Shift+Enter or Ctrl+Enter runs the query when
 * `onRunQuery` is provided.
 */
export const QueryInput = memo(function QueryInput({
  value,
  onChange,
  onRunQuery,
  onBlur,
  placeholder,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: QueryInputProps) {
  const theme = useTheme2();
  const config = useMemo(
    () => getQueryFieldConfig(theme, { onRunQuery, onBlur, placeholder }),
    [theme, onRunQuery, onBlur, placeholder]
  );

  return (
    <div className={styles.wrapper} data-testid={selectors.components.QueryField.container}>
      <CodeMirrorEditor
        value={value}
        onChange={onChange}
        {...config}
        height="auto"
        indentWithTab={false}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
      />
    </div>
  );
});
