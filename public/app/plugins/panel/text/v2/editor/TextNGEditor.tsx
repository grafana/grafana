import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import { type GrafanaTheme2, type InterpolateFunction } from '@grafana/data';
import { t } from '@grafana/i18n';
import { RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { CodeMirrorEditor, type CodeMirrorEditorLanguage } from '@grafana/ui/unstable';
import config from 'app/core/config';

import { CodeLanguage, TextMode } from '../../panelcfg.gen';
import { TextNGCodeView } from '../TextNGCodeView';
import { getInterpolateFormat, transformContent, getCodeMirrorLanguage } from '../utils';

import { TextNGFormatToolbar } from './TextNGFormatToolbar';

type ViewMode = 'write' | 'split' | 'preview';

export const PREVIEW_TEST_ID = 'TextNGEditor-preview';

export interface TextNGEditorProps {
  content: string;
  mode: TextMode;
  showLineNumbers: boolean;
  codeLanguage?: CodeLanguage;
  replaceVariables: InterpolateFunction;
  onChange: (content: string) => void;
}

const COMMIT_DEBOUNCE_MS = 250;

export function TextNGEditor({
  content,
  mode,
  showLineNumbers,
  codeLanguage,
  replaceVariables,
  onChange,
}: TextNGEditorProps) {
  const styles = useStyles2(getStyles);
  const [view, setView] = useState<ViewMode>(() => (content.trim().length === 0 ? 'write' : 'preview'));

  const [draft, setDraft] = useState(content);
  // a blur can fire before React re-renders with the new draft.
  const draftRef = useRef(content);
  const committedContent = useRef(content);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  const [prevContent, setPrevContent] = useState(content);
  if (content !== prevContent) {
    setPrevContent(content);
    if (content !== committedContent.current) {
      committedContent.current = content;
      draftRef.current = content;
      setDraft(content);
    }
  }

  // Stable identity: CodeMirrorEditor reconfigures itself whenever onChange
  // changes, which would otherwise happen on every keystroke.
  const handleDraftChange = useCallback((next: string) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const commitDraft = () => {
    const next = draftRef.current;
    if (next !== committedContent.current) {
      committedContent.current = next;
      onChange(next);
    }
  };

  // No unmount flush: exits blur (and commit) first, and flushing here could
  // overwrite externally reverted options (e.g. Discard).
  useDebounce(commitDraft, COMMIT_DEBOUNCE_MS, [draft]);

  const format = getInterpolateFormat(codeLanguage);
  const interpolatedContent = view === 'write' ? '' : replaceVariables(draft, {}, format);

  const previewHtml = useMemo(
    () => (mode === TextMode.Code ? '' : transformContent(mode, interpolatedContent, config.disableSanitizeHtml)),
    [mode, interpolatedContent]
  );

  let editorLanguage: CodeMirrorEditorLanguage | undefined;
  if (mode === TextMode.Markdown) {
    editorLanguage = getCodeMirrorLanguage(CodeLanguage.Markdown);
  } else if (mode === TextMode.HTML) {
    editorLanguage = getCodeMirrorLanguage(CodeLanguage.Html);
  } else if (mode === TextMode.Code) {
    editorLanguage = getCodeMirrorLanguage(codeLanguage);
  }

  const basicSetup = useMemo(
    () => ({ lineNumbers: mode === TextMode.Code ? showLineNumbers : false }),
    [mode, showLineNumbers]
  );

  const viewOptions = [
    { label: t('textng.editor.view-preview', 'Preview'), value: 'preview' as const },
    { label: t('textng.editor.view-split', 'Split'), value: 'split' as const },
    { label: t('textng.editor.view-write', 'Write'), value: 'write' as const },
  ];

  const showEditor = view !== 'preview';
  const showPreview = view !== 'write';

  const renderOutput = (testId: string) =>
    mode === TextMode.Code ? (
      <div className={styles.codeView} data-testid={testId}>
        <TextNGCodeView content={interpolatedContent} language={codeLanguage} showLineNumbers={showLineNumbers} />
      </div>
    ) : (
      <DangerouslySetHtmlContent
        allowRerender
        html={previewHtml}
        className={cx('markdown-html', styles.markdownHtml)}
        data-testid={testId}
      />
    );

  return (
    <div className={styles.wrapper} data-testid="TextNGEditor">
      <div className={styles.toolbar}>
        <RadioButtonGroup options={viewOptions} value={view} onChange={setView} size="sm" />
        {showEditor && <TextNGFormatToolbar mode={mode} editorContainerRef={editorContainerRef} />}
      </div>

      <div className={cx(styles.body, view === 'split' && styles.splitBody)}>
        {showEditor && (
          // Outside interactions (Save, Apply, Back) blur the editor on mousedown,
          // so a pending draft is committed before anything reads the options.
          <div ref={editorContainerRef} className={cx(styles.pane, styles.editorPane)} onBlur={commitDraft}>
            <CodeMirrorEditor
              value={draft}
              onChange={handleDraftChange}
              language={editorLanguage}
              lineWrapping
              basicSetup={basicSetup}
              height="100%"
              aria-label={t('textng.editor.aria-label-content', 'Text content')}
            />
          </div>
        )}
        {showPreview && <div className={cx(styles.pane, styles.previewPane)}>{renderOutput(PREVIEW_TEST_ID)}</div>}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    label: 'textNGEditor',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
  }),
  toolbar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    // Reserved so dropping the format toolbar in Preview does not shift the panes.
    minHeight: theme.spacing(theme.components.height.md),
  }),
  body: css({
    display: 'flex',
    flex: 1,
    width: '100%',
    minHeight: 0,
  }),
  splitBody: css({
    gap: theme.spacing(1),
  }),
  pane: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  editorPane: css({
    display: 'flex',
    flexDirection: 'column',
    // Give CodeMirror a bounded height so it scrolls internally instead of growing.
    '& > *': {
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
    },
  }),
  previewPane: css({
    overflow: 'auto',
    background: theme.colors.background.primary,
  }),
  markdownHtml: css({
    height: '100%',
    // Kept in sync with the rendered panel so content does not shift on edit.
    padding: theme.spacing(1, 2),
  }),
  codeView: css({
    height: '100%',
  }),
});
