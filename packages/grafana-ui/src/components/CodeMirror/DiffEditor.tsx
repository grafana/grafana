import { unifiedMergeView } from '@codemirror/merge';
import { Compartment, Text } from '@codemirror/state';
import { EditorView, drawSelection, lineNumbers as lineNumbersExtension } from '@codemirror/view';
import { css } from '@emotion/css';
import CodeMirror from '@uiw/react-codemirror';
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import CodeMirrorMerge, { type CodeMirrorMergeRef } from 'react-codemirror-merge';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';

import { createCodeEditorTheme } from './theme';
import { type CodeMirrorDiffEditorProps, type CodeMirrorExtension } from './types';
import { useLanguageExtension } from './useLanguageExtension';

const readOnlyOptions = { readOnly: true, editable: false, basicSetup: false, indentWithTab: false };

export function DiffEditor({
  original: originalValue,
  modified: modifiedValue,
  language,
  height,
  inline = false,
  lineNumbers = true,
}: CodeMirrorDiffEditorProps): ReactElement {
  // Match CodeMirror's line endings so the wrapper does not replace unchanged documents.
  const original = useMemo(() => originalValue.replace(/\r\n?/g, '\n'), [originalValue]);
  const modified = useMemo(() => modifiedValue.replace(/\r\n?/g, '\n'), [modifiedValue]);
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { extension: languageExtension, error: languageError } = useLanguageExtension(language);
  const editorTheme = useMemo(
    () => [
      createCodeEditorTheme(theme),
      EditorView.theme({
        // Line and word tints stack, so keep the line tint weaker to preserve syntax contrast.
        '&.cm-merge-b .cm-changedLine': { backgroundColor: colorManipulator.alpha(theme.colors.success.main, 0.1) },
        '&.cm-merge-a .cm-changedLine, .cm-deletedChunk': {
          backgroundColor: colorManipulator.alpha(theme.colors.error.main, 0.1),
        },
        '&.cm-merge-b .cm-changedText': { background: theme.colors.success.transparent },
        '&.cm-merge-a .cm-changedText, &.cm-merge-b .cm-deletedText': { background: theme.colors.error.transparent },
        '&.cm-merge-b .cm-changedLineGutter': { backgroundColor: theme.colors.success.main },
        '&.cm-merge-a .cm-changedLineGutter, .cm-deletedLineGutter': { backgroundColor: theme.colors.error.main },
      }),
    ],
    [theme]
  );
  const extensions = useMemo(
    () => [
      EditorView.contentAttributes.of({ tabindex: '0' }),
      drawSelection(),
      ...(lineNumbers ? [lineNumbersExtension()] : []),
      ...(languageExtension ? [languageExtension] : []),
    ],
    [lineNumbers, languageExtension]
  );
  // Reconfigure merge widgets with the theme so deleted text picks up new syntax colors.
  const inlineExtensions = useMemo(
    () => [
      editorTheme,
      ...extensions,
      EditorView.contentAttributes.of({ 'aria-label': t('grafana-ui.code-mirror.diff-modified', 'Modified') }),
      unifiedMergeView({ original, mergeControls: false }),
    ],
    [editorTheme, extensions, original]
  );

  return (
    <>
      {languageError && (
        <Alert title={t('grafana-ui.code-mirror.language-load-failed', 'Syntax highlighting failed to load')}>
          {t(
            'grafana-ui.code-mirror.language-load-failed-description',
            'The editor will continue without language-specific features.'
          )}
        </Alert>
      )}
      <div className={styles.container} style={{ height }}>
        {inline ? (
          <CodeMirror {...readOnlyOptions} value={modified} height="100%" theme="none" extensions={inlineExtensions} />
        ) : (
          <SideBySideDiffEditor original={original} modified={modified} theme={editorTheme} extensions={extensions} />
        )}
      </div>
    </>
  );
}

interface SideBySideDiffEditorProps {
  original: string;
  modified: string;
  theme: CodeMirrorExtension;
  extensions: CodeMirrorExtension;
}

function SideBySideDiffEditor({ original, modified, theme, extensions }: SideBySideDiffEditorProps): ReactElement {
  const [view, setView] = useState<CodeMirrorMergeRef['view']>();
  const setEditor = useCallback((editor: CodeMirrorMergeRef | null): void => {
    if (editor?.view) {
      setView(editor.view);
    }
  }, []);
  const [compartment] = useState(() => new Compartment());

  // The merge wrapper only reapplies extensions by recreating editors, which loses focus and scroll.
  useEffect(() => {
    const effects = compartment.reconfigure([theme, extensions]);
    view?.a.dispatch({ effects });
    view?.b.dispatch({ effects });
  }, [view, compartment, theme, extensions]);

  return (
    <CodeMirrorMerge ref={setEditor} theme="none" destroyRerender={false}>
      {/* The merge wrapper skips document updates for empty strings. */}
      <CodeMirrorMerge.Original
        {...readOnlyOptions}
        value={original || Text.empty}
        extensions={[
          compartment.of([theme, extensions]),
          EditorView.contentAttributes.of({ 'aria-label': t('grafana-ui.code-mirror.diff-original', 'Original') }),
        ]}
      />
      <CodeMirrorMerge.Modified
        {...readOnlyOptions}
        value={modified || Text.empty}
        extensions={[
          compartment.of([theme, extensions]),
          EditorView.contentAttributes.of({ 'aria-label': t('grafana-ui.code-mirror.diff-modified', 'Modified') }),
        ]}
      />
    </CodeMirrorMerge>
  );
}

const getStyles = (theme: GrafanaTheme2): Record<'container', string> => ({
  container: css({
    minHeight: 0,
    '.cm-theme-none, .cm-merge-theme': { height: '100%' },
    '.cm-mergeView': { height: '100%', overflow: 'auto' },
    '.cm-mergeViewEditor': { minWidth: 0 },
    '.cm-mergeViewEditor + .cm-mergeViewEditor': { borderLeft: `1px solid ${theme.colors.border.weak}` },
  }),
});
