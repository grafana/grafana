import { Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExtension } from '@codemirror/view';
import { css } from '@emotion/css';
import { memo, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { CodeMirrorEditor } from '../CodeMirror/CodeEditorLazy';
import { type CodeMirrorBasicSetup, type CodeMirrorEditorTheme, type CodeMirrorExtension } from '../CodeMirror/types';

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

const QUERY_INPUT_BASIC_SETUP: CodeMirrorBasicSetup = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  closeBrackets: false,
  bracketMatching: false,
  indentOnInput: false,
  autocompletion: false,
  drawSelection: false,
};

function createQueryInputTheme(theme: GrafanaTheme2): CodeMirrorEditorTheme {
  return EditorView.theme(
    {
      '&': {
        width: '100%',
        minHeight: theme.spacing(4),
        fontSize: theme.typography.body.fontSize,
        fontFamily: theme.typography.fontFamilyMonospace,
        color: theme.colors.text.primary,
        backgroundColor: theme.components.input.background,
        border: `1px solid ${theme.components.input.borderColor}`,
        borderRadius: theme.shape.radius.default,
      },
      '&.cm-focused': getFocusStyles(theme),
      '.cm-scroller': {
        fontFamily: theme.typography.fontFamilyMonospace,
        lineHeight: '18px',
      },
      '.cm-content': {
        padding: theme.spacing(0.75, 1),
        caretColor: theme.colors.text.primary,
      },
      '.cm-line': {
        padding: 0,
      },
      '.cm-placeholder': {
        color: theme.colors.text.disabled,
      },
    },
    { dark: theme.isDark }
  );
}

function createQueryInputExtensions({
  onRunQuery,
  onBlur,
  placeholder,
}: Pick<QueryInputProps, 'onRunQuery' | 'onBlur' | 'placeholder'>): CodeMirrorExtension[] {
  const extensions: CodeMirrorExtension[] = [EditorView.lineWrapping];

  if (onRunQuery) {
    const run = () => {
      onRunQuery();
      return true;
    };

    extensions.push(
      Prec.highest(
        keymap.of([
          { key: 'Shift-Enter', run },
          { key: 'Ctrl-Enter', run },
        ])
      )
    );
  }

  if (onBlur) {
    extensions.push(
      EditorView.domEventHandlers({
        blur: () => {
          onBlur();
          return false;
        },
      })
    );
  }

  if (placeholder) {
    extensions.push(placeholderExtension(placeholder));
  }

  return extensions;
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
  const editorTheme = useMemo(() => createQueryInputTheme(theme), [theme]);
  const extensions = useMemo(
    () => createQueryInputExtensions({ onRunQuery, onBlur, placeholder }),
    [onRunQuery, onBlur, placeholder]
  );

  return (
    <div className={styles.wrapper} data-testid={selectors.components.QueryField.container}>
      <CodeMirrorEditor
        value={value}
        onChange={onChange}
        theme={editorTheme}
        basicSetup={QUERY_INPUT_BASIC_SETUP}
        height="auto"
        extensions={extensions}
        indentWithTab={false}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
      />
    </div>
  );
});
