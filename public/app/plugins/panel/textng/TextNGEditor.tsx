import { html as htmlLang } from '@codemirror/lang-html';
import { markdown as markdownLang } from '@codemirror/lang-markdown';
import { type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { type ReactNode, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2, type IconName, renderTextPanelMarkdown, textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { RadioButtonGroup, ToolbarButton, ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';

import { CodeLanguage, TextMode } from './panelcfg.gen';

type ViewMode = 'write' | 'split' | 'preview';

interface FormatAction {
  key: string;
  tooltip: string;
  icon?: IconName;
  label?: ReactNode;
  onClick: () => void;
}

export interface TextNGEditorProps {
  content: string;
  mode: TextMode;
  wordWrap: boolean;
  showLineNumbers: boolean;
  codeLanguage?: CodeLanguage;
  onChange: (content: string) => void;
}

const MERMAID_SNIPPET = '```mermaid\nflowchart LR\n  A[Build] --> B[Test] --> C[Deploy]\n```\n';
const TABLE_SNIPPET = '\n| Column | Column |\n| ------ | ------ |\n| Value  | Value  |\n';

function renderPreviewHtml(mode: TextMode, content: string): string {
  if (!content) {
    return ' ';
  }
  return mode === TextMode.HTML ? textUtil.sanitizeTextPanelContent(content) : renderTextPanelMarkdown(content);
}

export function TextNGEditor({ content, mode, wordWrap, showLineNumbers, codeLanguage, onChange }: TextNGEditorProps) {
  const styles = useStyles2(getStyles);
  const [view, setView] = useState<ViewMode>(() => (content.trim().length === 0 ? 'write' : 'preview'));
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  const previewHtml = useMemo(() => (mode === TextMode.Code ? '' : renderPreviewHtml(mode, content)), [mode, content]);

  const extensions = useMemo(() => {
    const exts: Extension[] = [];
    if (wordWrap) {
      exts.push(EditorView.lineWrapping);
    }
    if (mode === TextMode.Markdown) {
      exts.push(markdownLang());
    } else if (mode === TextMode.HTML) {
      exts.push(htmlLang());
    }
    return exts;
  }, [mode, wordWrap]);

  const editorLanguage = mode === TextMode.Code && codeLanguage === CodeLanguage.Json ? 'json' : undefined;
  const basicSetup = useMemo(
    () => ({ lineNumbers: mode === TextMode.Code ? showLineNumbers : false }),
    [mode, showLineNumbers]
  );

  const getEditorView = () => (editorContainerRef.current ? EditorView.findFromDOM(editorContainerRef.current) : null);

  const surroundSelection = (before: string, after = before) => {
    const view = getEditorView();
    if (!view) {
      return;
    }
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    });
    view.focus();
  };

  const insertAtCursor = (text: string) => {
    const view = getEditorView();
    if (!view) {
      return;
    }
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  };

  const prefixSelectedLines = (prefix: string) => {
    const view = getEditorView();
    if (!view) {
      return;
    }
    const { state } = view;
    const { from, to } = state.selection.main;
    const startLine = state.doc.lineAt(from).number;
    const endLine = state.doc.lineAt(to).number;
    const changes = [];
    for (let n = startLine; n <= endLine; n++) {
      changes.push({ from: state.doc.line(n).from, insert: prefix });
    }
    // Map selection rightward so the caret lands after the inserted prefix.
    const changeSet = state.changes(changes);
    view.dispatch({ changes: changeSet, selection: state.selection.map(changeSet, 1) });
    view.focus();
  };

  const markdownActions: FormatAction[] = [
    {
      key: 'heading',
      tooltip: t('textng.editor.tooltip-heading', 'Heading'),
      label: t('textng.editor.format-heading', 'H'),
      onClick: () => prefixSelectedLines('# '),
    },
    {
      key: 'bold',
      tooltip: t('textng.editor.tooltip-bold', 'Bold'),
      label: <strong>{t('textng.editor.format-bold', 'B')}</strong>,
      onClick: () => surroundSelection('**'),
    },
    {
      key: 'italic',
      tooltip: t('textng.editor.tooltip-italic', 'Italic'),
      label: <em>{t('textng.editor.format-italic', 'I')}</em>,
      onClick: () => surroundSelection('*'),
    },
    {
      key: 'link',
      tooltip: t('textng.editor.tooltip-link', 'Link'),
      icon: 'link',
      onClick: () => surroundSelection('[', '](https://)'),
    },
    {
      key: 'bullet-list',
      tooltip: t('textng.editor.tooltip-bullet-list', 'Bullet list'),
      icon: 'list-ul',
      onClick: () => prefixSelectedLines('- '),
    },
    {
      key: 'numbered-list',
      tooltip: t('textng.editor.tooltip-numbered-list', 'Numbered list'),
      icon: 'list-ol',
      onClick: () => prefixSelectedLines('1. '),
    },
    {
      key: 'checklist',
      tooltip: t('textng.editor.tooltip-checklist', 'Checklist'),
      icon: 'check-square',
      onClick: () => prefixSelectedLines('- [ ] '),
    },
    {
      key: 'table',
      tooltip: t('textng.editor.tooltip-table', 'Table'),
      icon: 'table',
      onClick: () => insertAtCursor(TABLE_SNIPPET),
    },
    {
      key: 'mermaid',
      tooltip: t('textng.editor.tooltip-mermaid', 'Insert Mermaid diagram'),
      icon: 'code-branch',
      onClick: () => insertAtCursor(MERMAID_SNIPPET),
    },
  ];

  const htmlActions: FormatAction[] = [
    {
      key: 'bold',
      tooltip: t('textng.editor.tooltip-bold', 'Bold'),
      label: <strong>{t('textng.editor.format-bold', 'B')}</strong>,
      onClick: () => surroundSelection('<b>', '</b>'),
    },
    {
      key: 'italic',
      tooltip: t('textng.editor.tooltip-italic', 'Italic'),
      label: <em>{t('textng.editor.format-italic', 'I')}</em>,
      onClick: () => surroundSelection('<i>', '</i>'),
    },
    {
      key: 'link',
      tooltip: t('textng.editor.tooltip-link', 'Link'),
      icon: 'link',
      onClick: () => surroundSelection('<a href="https://">', '</a>'),
    },
  ];

  const insertVariableAction: FormatAction = {
    key: 'variable',
    tooltip: t('textng.editor.tooltip-insert-variable', 'Insert variable'),
    icon: 'brackets-curly',
    onClick: () => insertAtCursor('${}'),
  };

  const formatActions: FormatAction[] = [
    ...(mode === TextMode.Markdown ? markdownActions : mode === TextMode.HTML ? htmlActions : []),
    ...(mode === TextMode.Code ? [] : [insertVariableAction]),
  ];

  const viewOptions = [
    { label: t('textng.editor.view-preview', 'Preview'), value: 'preview' as const },
    { label: t('textng.editor.view-split', 'Split'), value: 'split' as const },
    { label: t('textng.editor.view-write', 'Write'), value: 'write' as const },
  ];

  const showEditor = view !== 'preview';
  const showPreview = view !== 'write';
  const lineCount = content ? content.split('\n').length : 0;
  const modeLabel = mode === TextMode.HTML ? 'HTML' : mode === TextMode.Code ? 'Code' : 'Markdown';

  const renderOutput = (testId: string) =>
    mode === TextMode.Code ? (
      <pre className={styles.codePreview} data-testid={testId}>
        {content}
      </pre>
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
        {/* Kept mounted (hidden) in Preview so the toolbar height stays stable. */}
        <ToolbarButtonRow
          className={cx(styles.formatting, view === 'preview' && styles.controlsHidden)}
          aria-hidden={view === 'preview'}
        >
          {view !== 'preview' &&
            formatActions.map(({ key, tooltip, icon, label, onClick }) => (
              <ToolbarButton key={key} icon={icon} tooltip={tooltip} onClick={onClick}>
                {label}
              </ToolbarButton>
            ))}
        </ToolbarButtonRow>
      </div>

      <div className={cx(styles.body, view === 'split' && styles.splitBody)}>
        {showEditor && (
          <div ref={editorContainerRef} className={cx(styles.pane, styles.editorPane)}>
            <CodeMirrorEditor
              value={content}
              onChange={onChange}
              language={editorLanguage}
              extensions={extensions}
              basicSetup={basicSetup}
              height="100%"
              aria-label={t('textng.editor.aria-label-content', 'Text content')}
            />
          </div>
        )}
        {showPreview && (
          <div className={cx(styles.pane, styles.previewPane)}>{renderOutput('TextNGEditor-preview')}</div>
        )}
      </div>

      <div className={styles.statusBar}>
        <span>{modeLabel}</span>
        <span>·</span>
        <span>
          {t('textng.editor.status-lines', '', {
            count: lineCount,
            defaultValue_one: '{{count}} line',
            defaultValue_other: '{{count}} lines',
          })}
        </span>
        <span>·</span>
        <span>
          {wordWrap
            ? t('textng.editor.status-wrap-on', 'Word wrap on')
            : t('textng.editor.status-wrap-off', 'Word wrap off')}
        </span>
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
    flexWrap: 'wrap',
    marginBottom: theme.spacing(1),
  }),
  formatting: css({
    flexWrap: 'wrap',
  }),
  controlsHidden: css({
    visibility: 'hidden',
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
    padding: theme.spacing(1, 2),
    background: theme.colors.background.primary,
  }),
  markdownHtml: css({
    height: '100%',
    // Skip layout/paint for off-screen blocks to keep large previews smooth.
    '& > *': {
      contentVisibility: 'auto',
      containIntrinsicSize: 'auto 2rem',
    },
  }),
  codePreview: css({
    margin: 0,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
  statusBar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
