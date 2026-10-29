import { getOriginalDoc, originalDocChangeEffect, unifiedMergeView } from '@codemirror/merge';
import { ChangeSet, Compartment, Text } from '@codemirror/state';
import { EditorView, drawSelection, lineNumbers as lineNumbersExtension } from '@codemirror/view';
import { css } from '@emotion/css';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirrorMerge, { type CodeMirrorMergeRef } from 'react-codemirror-merge';

import { type GrafanaTheme2 } from '@grafana/data';
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
  const inlineEditor = useRef<ReactCodeMirrorRef>(null);
  const editorTheme = useMemo(
    () => [
      createCodeEditorTheme(theme),
      EditorView.theme({
        '&.cm-merge-b .cm-changedLine': { backgroundColor: theme.colors.success.transparent },
        '&.cm-merge-a .cm-changedLine, .cm-deletedChunk': { backgroundColor: theme.colors.error.transparent },
        '&.cm-merge-b .cm-changedText': { background: theme.colors.success.transparent },
        '&.cm-merge-a .cm-changedText, .cm-deletedText': { background: theme.colors.error.transparent },
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
  const originalExtensions = useMemo(
    () => [
      ...extensions,
      EditorView.contentAttributes.of({ 'aria-label': t('grafana-ui.code-mirror.diff-original', 'Original') }),
    ],
    [extensions]
  );
  const modifiedExtensions = useMemo(
    () => [
      ...extensions,
      EditorView.contentAttributes.of({ 'aria-label': t('grafana-ui.code-mirror.diff-modified', 'Modified') }),
    ],
    [extensions]
  );
  const inlineExtensions = useMemo(
    () => (inline ? [...modifiedExtensions, unifiedMergeView({ original, mergeControls: false })] : []),
    [inline, modifiedExtensions, original]
  );

  useEffect(() => {
    const view = inlineEditor.current?.view;
    if (!inline || !view) {
      return;
    }

    // Refresh the baseline and cached deletion styles after language or theme changes.
    const previousOriginal = getOriginalDoc(view.state);
    view.dispatch({
      effects: originalDocChangeEffect(
        view.state,
        ChangeSet.of({ from: 0, to: previousOriginal.length, insert: original }, previousOriginal.length)
      ),
    });
  }, [inline, original, languageExtension, theme]);

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
          <CodeMirror
            {...readOnlyOptions}
            ref={inlineEditor}
            value={modified}
            height="100%"
            theme={editorTheme}
            extensions={inlineExtensions}
          />
        ) : (
          <SideBySideDiffEditor
            original={original}
            modified={modified}
            theme={editorTheme}
            originalExtensions={originalExtensions}
            modifiedExtensions={modifiedExtensions}
          />
        )}
      </div>
    </>
  );
}

interface SideBySideDiffEditorProps {
  original: string;
  modified: string;
  theme: CodeMirrorExtension;
  originalExtensions: CodeMirrorExtension;
  modifiedExtensions: CodeMirrorExtension;
}

function SideBySideDiffEditor({
  original,
  modified,
  theme,
  originalExtensions,
  modifiedExtensions,
}: SideBySideDiffEditorProps): ReactElement {
  const [view, setView] = useState<CodeMirrorMergeRef['view']>();
  const setEditor = useCallback((editor: CodeMirrorMergeRef | null): void => {
    if (editor?.view) {
      setView(editor.view);
    }
  }, []);
  const [configuration] = useState(() => {
    const originalCompartment = new Compartment();
    const modifiedCompartment = new Compartment();
    return {
      original: originalCompartment,
      modified: modifiedCompartment,
      originalExtensions: [originalCompartment.of([theme, originalExtensions])],
      modifiedExtensions: [modifiedCompartment.of([theme, modifiedExtensions])],
    };
  });

  // The merge wrapper only reapplies extensions by recreating editors, which loses focus and scroll.
  useEffect(() => {
    view?.a.dispatch({ effects: configuration.original.reconfigure([theme, originalExtensions]) });
    view?.b.dispatch({ effects: configuration.modified.reconfigure([theme, modifiedExtensions]) });
  }, [view, configuration, theme, originalExtensions, modifiedExtensions]);

  return (
    <CodeMirrorMerge ref={setEditor} theme="none" destroyRerender={false}>
      {/* The merge wrapper skips document updates for empty strings. */}
      <CodeMirrorMerge.Original
        {...readOnlyOptions}
        value={original || Text.empty}
        extensions={configuration.originalExtensions}
      />
      <CodeMirrorMerge.Modified
        {...readOnlyOptions}
        value={modified || Text.empty}
        extensions={configuration.modifiedExtensions}
      />
    </CodeMirrorMerge>
  );
}

const getStyles = (theme: GrafanaTheme2): Record<'container', string> => ({
  container: css({
    minHeight: 0,
    '.cm-theme, .cm-merge-theme': { height: '100%' },
    '.cm-mergeView': { height: '100%', overflow: 'auto' },
    '.cm-mergeViewEditor': { minWidth: 0 },
    '.cm-mergeViewEditor + .cm-mergeViewEditor': { borderLeft: `1px solid ${theme.colors.border.weak}` },
  }),
});
