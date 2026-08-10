import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import { type GrafanaTheme2, type InterpolateFunction, type VariableSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Dropdown, Icon, Menu, RadioButtonGroup, Stack, useStyles2, useTheme2 } from '@grafana/ui';
import { CodeMirrorEditor, useMarkdownLivePreview, type CodeMirrorEditorLanguage } from '@grafana/ui/unstable';
import config from 'app/core/config';

import { CodeLanguage, defaultCodeLanguage, TextMode } from '../../panelcfg.gen';
import { TextNGCodeView } from '../TextNGCodeView';
import { getInterpolateFormat, transformContent, getCodeMirrorLanguage } from '../utils';

import { TextNGEditorFooter } from './TextNGEditorFooter';
import { TextNGFormatToolbar } from './TextNGFormatToolbar';
import { getEditorLayoutStyles } from './editorLayout';
import { variableCompletion } from './variableCompletion';

type ViewMode = 'write' | 'split' | 'preview';

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
  replaceVariables: InterpolateFunction;
  suggestions?: VariableSuggestion[];
  onChange: (change: TextNGEditorChange) => void;
}

const getLanguageLabels = (): Record<CodeLanguage, string> => ({
  [CodeLanguage.Go]: 'Go',
  [CodeLanguage.Html]: 'HTML',
  [CodeLanguage.Json]: 'JSON',
  [CodeLanguage.Markdown]: 'Markdown',
  [CodeLanguage.Plaintext]: t('textng.editor.language-plaintext', 'Plain text'),
  [CodeLanguage.Sql]: 'SQL',
  [CodeLanguage.Typescript]: 'TypeScript',
  [CodeLanguage.Xml]: 'XML',
  [CodeLanguage.Yaml]: 'YAML',
});

const COMMIT_DEBOUNCE_MS = 250;
// Markdown, sanitization and the innerHTML reparse cost tens of milliseconds on
// a large document, so the preview trails typing.
const PREVIEW_DEBOUNCE_MS = 150;

export function TextNGEditor({
  content,
  mode,
  showLineNumbers,
  codeLanguage,
  replaceVariables,
  suggestions,
  onChange,
}: TextNGEditorProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  // Markdown renders its formatting as you type, so it opens in the editor and
  // has no split — the two panes would show the same thing. Preview remains for
  // what live preview cannot do: resolve variables and render tables.
  const isMarkdown = mode === TextMode.Markdown;

  const viewOptions = [
    { label: t('textng.editor.view-preview', 'Preview'), value: 'preview' as const },
    ...(isMarkdown ? [] : [{ label: t('textng.editor.view-split', 'Split'), value: 'split' as const }]),
    { label: t('textng.editor.view-write', 'Write'), value: 'write' as const },
  ];

  const [selectedView, setView] = useState<ViewMode>(() =>
    isMarkdown || content.trim().length === 0 ? 'write' : 'preview'
  );
  // Changing mode can retire the selected view, e.g. markdown has no split.
  const view = viewOptions.some((option) => option.value === selectedView) ? selectedView : 'write';

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

  const format = getInterpolateFormat(codeLanguage);
  const showPreview = view !== 'write';

  const interpolatedContent = useMemo(
    () => (showPreview ? replaceVariables(previewSource, {}, format) : ''),
    [showPreview, replaceVariables, previewSource, format]
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

  // Markdown is edited as a document: formatting renders in place, the syntax
  // markers only surface on the line being edited, and variables show their
  // values — so the editor already reads the way the panel will.
  const livePreviewExtensions = useMarkdownLivePreview(isMarkdown, (text) => replaceVariables(text, {}, format));

  const basicSetup = useMemo(
    () => ({
      lineNumbers: mode === TextMode.Code ? showLineNumbers : false,
      // Code chrome reads as a bug on a prose surface: an empty fold column, and
      // a grey band behind whichever line happens to be revealed.
      foldGutter: !isMarkdown,
      highlightActiveLine: !isMarkdown,
      highlightActiveLineGutter: !isMarkdown,
    }),
    [mode, showLineNumbers, isMarkdown]
  );

  const modeLabels: Record<TextMode, string> = {
    [TextMode.Markdown]: t('textng.editor.mode-markdown', 'Markdown'),
    [TextMode.HTML]: t('textng.editor.mode-html', 'HTML'),
    [TextMode.Code]: t('textng.editor.mode-code', 'Code'),
  };
  const languageLabels = getLanguageLabels();
  const languageOptions = Object.values(CodeLanguage).map((value) => ({ value, label: languageLabels[value] }));

  const language = codeLanguage ?? defaultCodeLanguage;
  const modeValue = mode === TextMode.Code ? `${modeLabels[mode]} · ${languageLabels[language]}` : modeLabels[mode];

  const renderModeMenu = () => (
    <Menu>
      {[TextMode.Markdown, TextMode.HTML].map((value) => (
        <Menu.Item
          key={value}
          className={styles.pickerMenuItem}
          label={modeLabels[value]}
          role="menuitemradio"
          ariaChecked={value === mode}
          active={value === mode}
          onClick={() => changeOption({ mode: value })}
        />
      ))}
      <Menu.Item
        className={styles.pickerMenuItem}
        label={modeLabels[TextMode.Code]}
        active={mode === TextMode.Code}
        childItems={languageOptions.map((option) => (
          <Menu.Item
            key={option.value}
            className={styles.pickerMenuItem}
            label={option.label}
            role="menuitemradio"
            ariaChecked={mode === TextMode.Code && option.value === language}
            active={mode === TextMode.Code && option.value === language}
            onClick={() => changeOption({ mode: TextMode.Code, codeLanguage: option.value })}
          />
        ))}
      />
    </Menu>
  );

  const showEditor = view !== 'preview';
  const isCode = mode === TextMode.Code;

  const renderOutput = (testId: string) =>
    isCode ? (
      <div className={styles.fullHeight} data-testid={testId}>
        <TextNGCodeView content={interpolatedContent} language={codeLanguage} showLineNumbers={showLineNumbers} />
      </div>
    ) : (
      <DangerouslySetHtmlContent
        allowRerender
        html={previewHtml}
        className={cx('markdown-html', styles.fullHeight)}
        data-testid={testId}
      />
    );

  return (
    <div className={styles.wrapper} data-testid="TextNGEditor">
      <Stack gap={1} alignItems="center" wrap="wrap" minHeight={theme.components.height.md}>
        <RadioButtonGroup options={viewOptions} value={view} onChange={setView} size="sm" />
        {showEditor && <TextNGFormatToolbar mode={mode} editorContainerRef={editorContainerRef} />}
        <Dropdown placement="bottom-end" overlay={renderModeMenu}>
          <Button
            className={styles.modePicker}
            fill="text"
            size="sm"
            variant="secondary"
            aria-label={t('textng.editor.aria-label-mode', 'Text mode: {{mode}}', { mode: modeValue })}
          >
            <Stack direction="row" alignItems="center" gap={0.5}>
              <span className={styles.pickerLabel}>{t('textng.editor.mode-picker-label', 'Mode')}</span>
              {modeValue}
              <Icon name="angle-down" />
            </Stack>
          </Button>
        </Dropdown>
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
              extensions={livePreviewExtensions}
              lineWrapping
              basicSetup={basicSetup}
              height="100%"
              aria-label={t('textng.editor.aria-label-content', 'Text content')}
            />
          </div>
        )}
        {showPreview && (
          <div className={cx(styles.pane, styles.previewPane, !isCode && styles.htmlPreviewPane)}>
            {renderOutput(PREVIEW_TEST_ID)}
          </div>
        )}
      </div>

      {isCode && (
        <TextNGEditorFooter
          showLineNumbers={showLineNumbers}
          onShowLineNumbersChange={(next) => changeOption({ showLineNumbers: next })}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  ...getEditorLayoutStyles(theme),
  modePicker: css({
    marginLeft: 'auto',
  }),
  pickerMenuItem: css({
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  pickerLabel: css({
    color: theme.colors.text.secondary,
  }),
  fullHeight: css({
    height: '100%',
  }),
});
