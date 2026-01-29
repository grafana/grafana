import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import {
  CoreApp,
  GrafanaTheme2,
  InterpolateFunction,
  PanelProps,
  renderTextPanelMarkdown,
  textUtil,
} from '@grafana/data';
import {
  CodeEditor,
  RadioButtonGroup,
  ScrollContainer,
  usePanelContext,
  useStyles2,
  type MonacoEditor,
} from '@grafana/ui';
import config from 'app/core/config';

import { defaultCodeOptions, Options, TextMode } from './panelcfg.gen';

export interface Props extends PanelProps<Options> {}

type InlineView = 'preview' | 'edit';

// PoC: this flag is injected by Scenes dashboard via `setDashboardPanelContext`.
// It should become a real `PanelContext` field if we turn this into a feature.
interface PanelContextWithDashboardEditing {
  isDashboardEditing?: boolean;
}

function hasScenesDashboardEditingFlag(v: unknown): v is PanelContextWithDashboardEditing {
  return typeof v === 'object' && v !== null && 'isDashboardEditing' in v;
}

export function TextPanel(props: Props) {
  const styles = useStyles2(getStyles);
  const context = usePanelContext();
  const { options, onOptionsChange } = props;
  // In classic dashboards, dashboard edit mode uses CoreApp.PanelEditor.
  // In Scenes ("dynamic dashboards") we also receive an additional flag via PanelContext.
  const isDashboardEditing = hasScenesDashboardEditingFlag(context) ? Boolean(context.isDashboardEditing) : false;
  const isEditing = context.app === CoreApp.PanelEditor || isDashboardEditing;

  const [inlineView, setInlineView] = useState<InlineView>('preview');
  const [draft, setDraft] = useState(props.options.content ?? '');
  const [isDirty, setIsDirty] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Monaco editor instance (set when editor mounts)
  const editorRef = useRef<MonacoEditor | null>(null);
  const commitDraftRef = useRef<(next: string) => void>(() => {});

  const inlineViewOptions = [
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    { label: 'Edit', value: 'edit' as const },
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    { label: 'Preview', value: 'preview' as const },
  ];

  useEffect(() => {
    if (!isEditing && inlineView !== 'preview') {
      setInlineView('preview');
    }
  }, [inlineView, isEditing]);

  useEffect(() => {
    // If the content changes externally (options editor, model updates), sync the draft unless the user is editing.
    if (!isDirty) {
      setDraft(props.options.content ?? '');
    }
  }, [isDirty, props.options.content]);

  const [processed, setProcessed] = useState<Options>({
    mode: props.options.mode,
    content: processContent(props.options, props.replaceVariables, config.disableSanitizeHtml),
  });

  useDebounce(
    () => {
      const { options, replaceVariables } = props;
      const content = processContent(options, replaceVariables, config.disableSanitizeHtml);
      if (content !== processed.content || options.mode !== processed.mode) {
        setProcessed({
          mode: options.mode,
          content,
        });
      }
    },
    100,
    [props]
  );

  const canInlineEdit = isEditing && (processed.mode === TextMode.Markdown || processed.mode === TextMode.HTML);

  const commitDraft = useCallback(
    (next: string) => {
      setDraft(next);
      setIsDirty(false);
      onOptionsChange({
        ...options,
        content: next,
      });
    },
    [onOptionsChange, options]
  );

  useEffect(() => {
    commitDraftRef.current = commitDraft;
  }, [commitDraft]);

  const onInlineViewChange = (next: InlineView) => {
    // When switching back to preview, persist the current draft so the panel shows what you just edited.
    if (next === 'preview' && isDirty) {
      commitDraft(draft);
    }
    setInlineView(next);
  };

  // Reuse Ctrl/Cmd+Enter as a hover-scoped toggle:
  // - Preview -> Edit
  // - Edit -> commit + Preview (even if the editor isn't focused)
  //
  // This is only active while hovering this panel (so multiple text panels won't conflict),
  // and only when inline editing is enabled.
  useEffect(() => {
    if (!canInlineEdit || !isHovering) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const tag = target?.tagName?.toLowerCase();
      const isEditableTarget =
        tag === 'input' ||
        tag === 'textarea' ||
        target?.isContentEditable ||
        (target instanceof HTMLElement && target.closest('[contenteditable="true"]'));
      if (isEditableTarget) {
        return;
      }

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        if (inlineView === 'preview') {
          setInlineView('edit');
          return;
        }

        // inlineView === 'edit'
        commitDraftRef.current(draft);
        setInlineView('preview');
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [canInlineEdit, draft, inlineView, isHovering]);

  useEffect(() => {
    if (inlineView === 'edit') {
      // Focus if the editor is already mounted. If not, onEditorDidMount will focus.
      requestAnimationFrame(() => editorRef.current?.focus());
    }
  }, [inlineView]);

  if (processed.mode === TextMode.Code) {
    const code = props.options.code ?? defaultCodeOptions;
    return (
      <CodeEditor
        key={`${code.showLineNumbers}/${code.showMiniMap}`} // will reinit-on change
        value={processed.content}
        language={code.language ?? defaultCodeOptions.language!}
        width={props.width}
        height={props.height}
        containerStyles={styles.codeEditorContainer}
        showMiniMap={code.showMiniMap}
        showLineNumbers={code.showLineNumbers}
        readOnly={true} // future
      />
    );
  }

  return (
    <div className={styles.root} onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
      {canInlineEdit && (
        <div
          className={cx(styles.inlineControls, 'grid-drag-cancel', 'show-on-hover')}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <RadioButtonGroup
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            aria-label="Text panel view"
            value={inlineView}
            options={inlineViewOptions}
            onChange={onInlineViewChange}
            size="sm"
            className={styles.toggleGroup}
          />
        </div>
      )}

      {canInlineEdit && inlineView === 'edit' ? (
        <CodeEditor
          value={draft}
          onChange={(v) => {
            setDraft(v);
            setIsDirty(true);
          }}
          onBlur={(v) => commitDraft(v)}
          onSave={(v) => commitDraft(v)}
          onEditorDidMount={(editor, monaco) => {
            editorRef.current = editor;

            // If we just switched into edit, focus immediately on mount.
            if (inlineView === 'edit') {
              requestAnimationFrame(() => editor.focus());
            }

            // Avoid using Escape (often globally mapped); provide a safe editor-local shortcut:
            // Ctrl/Cmd+Enter => commit and switch to Preview.
            editor.onKeyDown((e) => {
              if (e.keyCode === monaco.KeyCode.Enter && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const next = editor.getValue();
                commitDraftRef.current(next);
                setInlineView('preview');
              }
            });
          }}
          onEditorWillUnmount={() => {
            editorRef.current = null;
          }}
          language={processed.mode === TextMode.HTML ? 'html' : 'markdown'}
          width={props.width}
          height={props.height}
          containerStyles={styles.inlineEditorContainer}
          showMiniMap={false}
          showLineNumbers={false}
        />
      ) : (
        <div className={styles.containStrict}>
          <ScrollContainer minHeight="100%">
            <DangerouslySetHtmlContent
              allowRerender
              html={processed.content}
              className={cx('markdown-html', styles.markdownHtml)}
              data-testid="TextPanel-converted-content"
            />
          </ScrollContainer>
        </div>
      )}
    </div>
  );
}

function processContent(options: Options, interpolate: InterpolateFunction, disableSanitizeHtml: boolean): string {
  let { mode, content } = options;

  // Variables must be interpolated before content is converted to markdown so using variables
  // in URLs work properly
  content = interpolate(content, {}, options.code?.language === 'json' ? 'json' : 'html');

  if (!content) {
    return ' ';
  }

  switch (mode) {
    case TextMode.Code:
      break; // nothing
    case TextMode.HTML:
      if (!disableSanitizeHtml) {
        content = textUtil.sanitizeTextPanelContent(content);
      }
      break;
    case TextMode.Markdown:
    default:
      // default to markdown
      content = renderTextPanelMarkdown(content, {
        noSanitize: disableSanitizeHtml,
      });
  }

  return content;
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    position: 'relative',
    height: '100%',
    width: '100%',
  }),
  codeEditorContainer: css({
    '.monaco-editor .margin, .monaco-editor-background': {
      backgroundColor: theme.colors.background.primary,
    },
  }),
  inlineEditorContainer: css({
    height: '100%',
    width: '100%',
    '.monaco-editor .margin, .monaco-editor-background': {
      backgroundColor: theme.colors.background.primary,
    },
  }),
  inlineControls: css({
    position: 'absolute',
    // Hacky PoC positioning: lift into the panel header area so it aligns with the "..." menu
    // without stealing vertical space from the rendered content.
    top: theme.spacing(-5),
    right: theme.spacing(4.25),
    zIndex: theme.zIndex.dropdown,
    pointerEvents: 'auto',
  }),
  toggleGroup: css({
    boxShadow: theme.shadows.z2,
  }),
  containStrict: css({
    contain: 'strict',
    height: '100%',
    display: 'flex',
  }),
  markdownHtml: css({
    height: '100%',
  }),
});
