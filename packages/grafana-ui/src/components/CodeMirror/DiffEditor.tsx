import { MergeView, getOriginalDoc, originalDocChangeEffect, unifiedMergeView } from '@codemirror/merge';
import { ChangeSet, Compartment, EditorState } from '@codemirror/state';
import { EditorView, drawSelection, lineNumbers as lineNumbersExtension } from '@codemirror/view';
import { css } from '@emotion/css';
import { useEffect, useMemo, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';

import { createCodeEditorTheme } from './theme';
import { type CodeMirrorDiffEditorProps } from './types';
import { useLanguageExtension } from './useLanguageExtension';

export function DiffEditor({
  original,
  modified,
  language,
  height,
  inline = false,
  lineNumbers = true,
}: CodeMirrorDiffEditorProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { extension: languageExtension, error: languageError } = useLanguageExtension(language);
  const container = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MergeView | EditorView | null>(null);
  const configuration = useMemo(() => new Compartment(), []);
  const extensions = useMemo(
    () => [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.contentAttributes.of({ tabindex: '0' }),
      drawSelection(),
      createCodeEditorTheme(theme),
      EditorView.theme({
        '&.cm-merge-b .cm-changedLine': { backgroundColor: theme.colors.success.transparent },
        '&.cm-merge-a .cm-changedLine, .cm-deletedChunk': { backgroundColor: theme.colors.error.transparent },
        '&.cm-merge-b .cm-changedText': { background: theme.colors.success.transparent },
        '&.cm-merge-a .cm-changedText, .cm-deletedText': { background: theme.colors.error.transparent },
        '&.cm-merge-b .cm-changedLineGutter': { backgroundColor: theme.colors.success.main },
        '&.cm-merge-a .cm-changedLineGutter, .cm-deletedLineGutter': { backgroundColor: theme.colors.error.main },
      }),
      ...(lineNumbers ? [lineNumbersExtension()] : []),
      ...(languageExtension ? [languageExtension] : []),
    ],
    [theme, lineNumbers, languageExtension]
  );
  const latest = useRef({ original, modified, extensions });
  latest.current = { original, modified, extensions };

  // Inline deletion widgets cache syntax styles, so language and theme changes need a fresh view.
  useEffect(() => {
    if (!container.current) {
      return;
    }

    const { original, modified, extensions } = latest.current;
    const modifiedExtensions = [
      configuration.of(extensions),
      EditorView.contentAttributes.of({ 'aria-label': t('grafana-ui.code-mirror.diff-modified', 'Modified') }),
    ];
    const view = inline
      ? new EditorView({
          parent: container.current,
          doc: modified,
          extensions: [modifiedExtensions, unifiedMergeView({ original, mergeControls: false })],
        })
      : new MergeView({
          parent: container.current,
          a: {
            doc: original,
            extensions: [
              configuration.of(extensions),
              EditorView.contentAttributes.of({ 'aria-label': t('grafana-ui.code-mirror.diff-original', 'Original') }),
            ],
          },
          b: { doc: modified, extensions: modifiedExtensions },
        });
    viewRef.current = view;

    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [inline, configuration, languageExtension, theme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const update = (editor: EditorView, value: string) => {
      editor.dispatch({
        changes:
          editor.state.doc.toString() === value ? undefined : { from: 0, to: editor.state.doc.length, insert: value },
        effects: configuration.reconfigure(extensions),
      });
    };

    if (view instanceof MergeView) {
      update(view.a, original);
      update(view.b, modified);
    } else {
      const previousOriginal = getOriginalDoc(view.state);
      if (previousOriginal.toString() !== original) {
        view.dispatch({
          effects: originalDocChangeEffect(
            view.state,
            ChangeSet.of({ from: 0, to: previousOriginal.length, insert: original }, previousOriginal.length)
          ),
        });
      }
      update(view, modified);
    }
  }, [original, modified, extensions, configuration, inline]);

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
      <div ref={container} className={styles.container} style={{ height }} />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    minHeight: 0,
    '& > .cm-editor': { height: '100%' },
    '& > .cm-mergeView': { height: '100%', overflow: 'auto' },
    '.cm-mergeViewEditor': { minWidth: 0 },
    '.cm-mergeViewEditor + .cm-mergeViewEditor': { borderLeft: `1px solid ${theme.colors.border.weak}` },
  }),
});
