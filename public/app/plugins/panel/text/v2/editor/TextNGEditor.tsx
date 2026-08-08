import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import {
  type GrafanaTheme2,
  type IconName,
  type InterpolateFunction,
  type SelectableValue,
  type VariableSuggestion,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Dropdown, Icon, Menu, RadioButtonGroup, Stack, useStyles2, useTheme2 } from '@grafana/ui';
import { CodeMirrorEditor, type CodeMirrorEditorLanguage } from '@grafana/ui/unstable';
import config from 'app/core/config';

import { CodeLanguage, defaultCodeLanguage, TextMode } from '../../panelcfg.gen';
import { TextNGCodeView } from '../TextNGCodeView';
import { getInterpolateFormat, transformContent, getCodeMirrorLanguage } from '../utils';

import { TextNGEditorFooter } from './TextNGEditorFooter';
import { TextNGFormatToolbar } from './TextNGFormatToolbar';
import { getEditorView } from './editorCommands';
import { getEditorLayoutStyles } from './editorLayout';
import { variableCompletion } from './variableCompletion';

export type ViewMode = 'write' | 'split' | 'preview';

export const PREVIEW_TEST_ID = 'TextNGEditor-preview';

/** Below this the chrome has to collapse to a single row to leave any room for content. */
const COMPACT_MAX_HEIGHT = 190;

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
  /** Height to fit into. Below a threshold the chrome collapses to a single row. */
  availableHeight?: number;
  /** Defaults to true. Split needs more room than a dashboard panel has. */
  allowSplit?: boolean;
  /** Overrides the default of Write for an empty panel, Preview otherwise. */
  defaultView?: ViewMode;
  /** Focus the text area on mount, if it opens in a view that has one. */
  autoFocus?: boolean;
  /** Host-owned, so the view survives the editor unmounting. */
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
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
  availableHeight,
  allowSplit = true,
  defaultView,
  autoFocus,
  view: viewProp,
  onViewChange,
  onChange,
}: TextNGEditorProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const [localView, setLocalView] = useState<ViewMode>(() => defaultView ?? (content.trim() ? 'preview' : 'write'));
  const requested = viewProp ?? localView;
  const isCompact = (availableHeight ?? Infinity) < COMPACT_MAX_HEIGHT;

  // Derived, not corrected in an effect, so a stale 'split' cannot wedge the editor.
  const view = !allowSplit && requested === 'split' ? 'write' : requested;

  const setView = (next: ViewMode) => {
    setLocalView(next);
    onViewChange?.(next);
  };

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

  // Only when it opens on the text area; focusing a Preview-opened panel would steal the keyboard
  // from someone who only meant to select it.
  const shouldAutoFocus = autoFocus && view === 'write';
  useEffect(() => {
    if (!shouldAutoFocus) {
      return;
    }

    // The lazily-loaded CodeMirror bundle can mount its view a tick after this effect runs.
    const focus = () => Boolean(getEditorView(editorContainerRef)?.focus());
    if (focus()) {
      return;
    }

    const id = setTimeout(focus);
    return () => clearTimeout(id);
    // Only on mount: refocusing on later view changes would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoFocus]);

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

  const basicSetup = useMemo(
    () => ({ lineNumbers: mode === TextMode.Code ? showLineNumbers : false }),
    [mode, showLineNumbers]
  );

  const views: Array<{ value: ViewMode; label: string; icon: IconName }> = [
    { value: 'preview', label: t('textng.editor.view-preview', 'Preview'), icon: 'eye' },
    { value: 'split', label: t('textng.editor.view-split', 'Split'), icon: 'columns' },
    { value: 'write', label: t('textng.editor.view-write', 'Write'), icon: 'pen' },
  ];

  // Icon-only when compact, with the labels kept as accessible names.
  const viewOptions: Array<SelectableValue<ViewMode>> = views
    .filter(({ value }) => value !== 'split' || allowSplit)
    .map(({ value, label, icon }) => (isCompact ? { value, icon, ariaLabel: label } : { value, label }));

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
      {/* A compact panel has no room for the footer, so its one option moves in here. */}
      {isCompact && mode === TextMode.Code && (
        <>
          <Menu.Divider />
          <Menu.Item
            className={styles.pickerMenuItem}
            label={t('textng.editor.footer-line-numbers', 'Line numbers')}
            role="menuitemcheckbox"
            ariaChecked={showLineNumbers}
            active={showLineNumbers}
            onClick={() => changeOption({ showLineNumbers: !showLineNumbers })}
          />
        </>
      )}
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
        {showEditor && <TextNGFormatToolbar mode={mode} editorContainerRef={editorContainerRef} compact={isCompact} />}
        <Dropdown placement="bottom-end" overlay={renderModeMenu}>
          <Button
            className={styles.modePicker}
            fill="text"
            size="sm"
            variant="secondary"
            aria-label={t('textng.editor.aria-label-mode', 'Text mode: {{mode}}', { mode: modeValue })}
          >
            <Stack direction="row" alignItems="center" gap={0.5}>
              {!isCompact && <span className={styles.pickerLabel}>{t('textng.editor.mode-picker-label', 'Mode')}</span>}
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

      {isCode && !isCompact && (
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
