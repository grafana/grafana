import { css, cx } from '@emotion/css';
import { useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { useDebounce } from 'react-use';

import { type DataFrame, type GrafanaTheme2, type InterpolateFunction, type VariableSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, RadioButtonGroup, Stack, useStyles2, useTheme2 } from '@grafana/ui';
import { CodeMirrorEditor, createCodeEditorTheme, type CodeMirrorEditorLanguage } from '@grafana/ui/unstable';
import config from 'app/core/config';

import { CodeLanguage, type RenderMode, TextMode } from '../../panelcfg.gen';
import { TextNGCodeView } from '../TextNGCodeView';
import { TextNGHtmlView } from '../TextNGHtmlView';
import { catchTemplateError, interpolateTemplate, type RowWindow } from '../renderContent';
import { getInterpolateFormat, transformContent, getCodeMirrorLanguage } from '../utils';

import { TextNGEditorFooter } from './TextNGEditorFooter';
import { TextNGFormatToolbar } from './TextNGFormatToolbar';
import { TextNGModePicker } from './TextNGModePicker';
import { getEditorLayoutStyles } from './editorLayout';
import { variableCompletion } from './variableCompletion';
import { type ViewMode } from './viewMode';

export const PREVIEW_TEST_ID = 'TextNGEditor-preview';

/** Options the editor owns, always sent together with the current content. */
export interface TextNGEditorChange {
  content: string;
  mode?: TextMode;
  codeLanguage?: CodeLanguage;
  showLineNumbers?: boolean;
}

export interface TextNGEditorProps {
  content: string;
  mode: TextMode;
  showLineNumbers: boolean;
  codeLanguage?: CodeLanguage;
  renderMode?: RenderMode;
  rowWindow?: RowWindow;
  frameSelector?: ReactNode;
  pagination?: ReactNode;
  previewRef?: Ref<HTMLDivElement>;
  series?: DataFrame[];
  replaceVariables: InterpolateFunction;
  suggestions?: VariableSuggestion[];
  onChange: (change: TextNGEditorChange) => void;
  /** Held by the panel so a frame-count change, which remounts this editor, cannot reset it. */
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  /** Mirrors the panel's transparent background option. */
  transparent?: boolean;
}

const COMMIT_DEBOUNCE_MS = 250;
// Markdown, sanitization and the innerHTML reparse cost tens of milliseconds on
// a large document, so the preview trails typing.
const PREVIEW_DEBOUNCE_MS = 150;

export function TextNGEditor({
  content,
  mode,
  showLineNumbers,
  codeLanguage,
  renderMode,
  rowWindow,
  frameSelector,
  pagination,
  previewRef,
  series,
  replaceVariables,
  suggestions,
  onChange,
  view,
  onViewChange,
  transparent,
}: TextNGEditorProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const editorTheme = useMemo(
    () => (transparent ? createCodeEditorTheme(theme, { transparent: true }) : undefined),
    [theme, transparent]
  );

  const [draft, setDraft] = useState(content);
  // a blur can fire before React re-renders with the new draft.
  const draftRef = useRef(content);
  const committedContent = useRef(content);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Trails `draft`, except where waiting would show something stale.
  const [previewSource, setPreviewSource] = useState(content);

  const [prevContent, setPrevContent] = useState(content);
  if (content !== prevContent) {
    setPrevContent(content);
    if (content !== committedContent.current) {
      committedContent.current = content;
      draftRef.current = content;
      setDraft(content);
      setPreviewSource(content);
    }
  }

  const [prevView, setPrevView] = useState(view);
  if (prevView !== view) {
    setPrevView(view);
    setPreviewSource(draftRef.current);
  }

  const handleDraftChange = (next: string) => {
    draftRef.current = next;
    setDraft(next);
  };

  const commitDraft = () => {
    const next = draftRef.current;
    if (next !== committedContent.current) {
      committedContent.current = next;
      onChange({ content: next });
    }
  };

  // Carries the pending draft, so the single options update cannot drop it.
  const changeOption = (change: Omit<TextNGEditorChange, 'content'>) => {
    committedContent.current = draftRef.current;
    onChange({ ...change, content: draftRef.current });
  };

  // No unmount flush: exits blur (and commit) first, and flushing here could
  // overwrite externally reverted options (e.g. Discard).
  useDebounce(commitDraft, COMMIT_DEBOUNCE_MS, [draft]);

  useDebounce(() => setPreviewSource(draftRef.current), PREVIEW_DEBOUNCE_MS, [draft]);

  const format = getInterpolateFormat(mode, codeLanguage);
  const showPreview = view !== 'write';

  const { content: interpolatedContent, error: previewError } = useMemo(
    () =>
      catchTemplateError(() =>
        showPreview
          ? interpolateTemplate(
              { content: previewSource, mode, series, renderMode, rowWindow, format },
              replaceVariables
            )
          : ''
      ),
    [showPreview, previewSource, mode, series, renderMode, rowWindow, format, replaceVariables]
  );

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

  const completionSources = useMemo(() => [variableCompletion(suggestions ?? [])], [suggestions]);

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
  const isCode = mode === TextMode.Code;
  const footerPagination = showPreview ? pagination : null;

  const renderOutput = (testId: string) => {
    if (previewError) {
      return <Alert severity="error" title={previewError} data-testid={testId} />;
    }

    return isCode ? (
      <div className={styles.fullHeight} data-testid={testId}>
        <TextNGCodeView
          content={interpolatedContent}
          language={codeLanguage}
          showLineNumbers={showLineNumbers}
          transparent={transparent}
        />
      </div>
    ) : (
      <TextNGHtmlView html={previewHtml} className={cx('markdown-html', styles.fullHeight)} testId={testId} />
    );
  };

  return (
    <div className={styles.wrapper} data-testid="TextNGEditor">
      <Stack gap={1} alignItems="center" wrap="wrap" minHeight={theme.components.height.md}>
        <RadioButtonGroup options={viewOptions} value={view} onChange={onViewChange} size="sm" />
        {showEditor && <TextNGFormatToolbar mode={mode} editorContainerRef={editorContainerRef} />}
        <TextNGModePicker mode={mode} codeLanguage={codeLanguage} onChange={changeOption} />
      </Stack>

      <div className={cx(styles.body, view === 'split' && styles.splitBody)}>
        {showEditor && (
          // Outside interactions (Save, Apply, Back) blur the editor on mousedown,
          // so a pending draft is committed before anything reads the options.
          <div ref={editorContainerRef} className={cx(styles.pane, styles.editorPane)} onBlur={commitDraft}>
            <CodeMirrorEditor
              value={draft}
              onChange={handleDraftChange}
              language={editorLanguage}
              completionSources={completionSources}
              lineWrapping
              basicSetup={basicSetup}
              height="100%"
              aria-label={t('textng.editor.aria-label-content', 'Text content')}
              theme={editorTheme}
            />
          </div>
        )}
        {showPreview && (
          <div
            ref={previewRef}
            className={cx(
              styles.pane,
              styles.previewPane,
              !transparent && styles.previewPaneOpaque,
              !isCode && styles.htmlPreviewPane
            )}
          >
            {renderOutput(PREVIEW_TEST_ID)}
          </div>
        )}
      </div>

      {(isCode || frameSelector || footerPagination) && (
        <TextNGEditorFooter
          showLineNumbersSwitch={isCode}
          showLineNumbers={showLineNumbers}
          onShowLineNumbersChange={(next) => changeOption({ showLineNumbers: next })}
          frameSelector={frameSelector}
          pagination={footerPagination}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  ...getEditorLayoutStyles(theme),
  fullHeight: css({
    height: '100%',
  }),
});
