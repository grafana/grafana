import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import {
  CoreApp,
  getFrameDisplayName,
  type DataFrame,
  type GrafanaTheme2,
  type PanelProps,
  type InterpolateFunction,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Combobox, Field, ScrollContainer, Stack, usePanelContext, useStyles2, useTheme2 } from '@grafana/ui';
import config from 'app/core/config';
import { getDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import {
  type CodeOptions,
  defaultCodeLanguage,
  defaultCodeOptions,
  defaultOptions,
  type Options,
  TextMode,
} from '../panelcfg.gen';

import { TextNGCodeView } from './TextNGCodeView';
import { type TextNGEditorChange, type ViewMode } from './editor/TextNGEditor';
import { getEditorLayoutStyles } from './editor/editorLayout';
import { catchTemplateError, renderContent, type RenderedContent } from './renderContent';
import { EMPTY_CONTENT, getCurrentFrameIndex, getInterpolateFormat } from './utils';

const TextNGEditor = lazy(() => import('./editor/TextNGEditor').then((m) => ({ default: m.TextNGEditor })));

export interface Props extends PanelProps<Options> {}

export function TextNGPanel(props: Props) {
  const { app } = usePanelContext();
  const { options, onOptionsChange, replaceVariables, data, renderCounter, fitContent } = props;
  const isEditing = app === CoreApp.PanelEditor;
  // Fit-content only applies to the rendered view: the inline editor keeps its
  // bounded, scrollable layout since active editing needs stable interactive space.
  const fitContentOn = fitContent && !isEditing;
  const content = options.content ?? defaultOptions.content ?? '';

  const frames = data.series;
  const currentFrameIndex = getCurrentFrameIndex(frames, options);
  const series = useMemo(() => (frames.length > 1 ? [frames[currentFrameIndex]] : frames), [frames, currentFrameIndex]);

  const suggestions = useMemo(() => (isEditing ? getDataLinksVariableSuggestions(series) : []), [isEditing, series]);

  // Adding or removing a query toggles the frame picker, which changes the tree
  // shape and remounts the editor, so its view mode is held here instead.
  const [view, setView] = useState<ViewMode>(() => (content.trim().length === 0 ? 'write' : 'preview'));

  const [processed, setProcessed] = useState<ProcessedContent>(() =>
    // The editor renders its own preview, so skip the render pass on entry.
    isEditing ? { mode: options.mode, content: EMPTY_CONTENT } : renderPanelContent(options, series, replaceVariables)
  );

  // Recompute synchronously when leaving edit mode so pre-edit content never flashes.
  const [wasEditing, setWasEditing] = useState(isEditing);
  if (wasEditing !== isEditing) {
    setWasEditing(isEditing);
    if (!isEditing) {
      setProcessed(renderPanelContent(options, series, replaceVariables));
    }
  }

  // Batches bursts of change (data/variable refresh) so the interpolate and
  // markdown/sanitize pass runs once per burst. renderCounter covers a
  // referenced variable changing, which leaves options and data untouched.
  useDebounce(
    () => {
      if (isEditing) {
        return;
      }
      const next = renderPanelContent(options, series, replaceVariables);
      if (next.content !== processed.content || next.mode !== processed.mode || next.error !== processed.error) {
        setProcessed(next);
      }
    },
    100,
    [
      isEditing,
      options.content,
      options.mode,
      options.renderMode,
      options.code?.language,
      series,
      replaceVariables,
      renderCounter,
    ]
  );

  const panel = isEditing ? (
    // Show the rendered content while the editor chunk loads; the editor
    // opens in Preview view, so the content stays in place.
    <Suspense
      fallback={<EditorLoadingFallback options={options} series={series} replaceVariables={replaceVariables} />}
    >
      <TextNGEditor
        content={content}
        mode={options.mode}
        showLineNumbers={options.code?.showLineNumbers ?? false}
        codeLanguage={options.code?.language}
        renderMode={options.renderMode}
        series={series}
        replaceVariables={replaceVariables}
        suggestions={suggestions}
        onChange={(change) => onOptionsChange(applyEditorChange(options, change))}
        view={view}
        onViewChange={setView}
      />
    </Suspense>
  ) : (
    <TextNGView {...processed} code={options.code} fitContent={fitContentOn} />
  );

  if (frames.length <= 1) {
    return panel;
  }

  const frameOptions = frames.map((frame, index) => ({
    label: getFrameDisplayName(frame),
    value: index,
  }));

  const framePicker = (
    <Field noMargin>
      <Combobox
        aria-label={t('textng.frame-picker.label', 'Query')}
        options={frameOptions}
        value={frameOptions[currentFrameIndex]}
        onChange={(val) => onOptionsChange({ ...options, frameIndex: val.value ?? 0 })}
      />
    </Field>
  );

  // Fit-content: no fixed-height flex wrapper — the picker sits below the panel
  // in normal flow so the stack's natural height, not a forced 100%, is what
  // the layout measures.
  if (fitContentOn) {
    return (
      <Stack direction="column" gap={1}>
        {panel}
        {framePicker}
      </Stack>
    );
  }

  return (
    <Stack direction="column" gap={1} height="100%">
      <Stack direction="column" grow={1} minHeight={0}>
        {panel}
      </Stack>
      {framePicker}
    </Stack>
  );
}

interface ProcessedContent extends RenderedContent {
  mode: TextMode;
}

interface TextNGViewProps extends ProcessedContent {
  code: Options['code'];
  fitContent?: boolean;
}

function TextNGView({ mode, content, error, code, fitContent }: TextNGViewProps) {
  const styles = useStyles2(getStyles);

  if (error) {
    return <Alert severity="error" title={error} data-testid="TextNGPanel-error" />;
  }

  if (mode === TextMode.Code) {
    const codeOptions = code ?? defaultCodeOptions;
    // CodeMirror always wraps lines here, so a line-count estimate (as v1 uses
    // for Monaco, which doesn't wrap) would undercount soft-wrapped lines. Use
    // 'auto' instead: CodeMirror's own .cm-scroller is forced to a CSS height
    // of 100%, which resolves to auto against an auto-height .cm-editor, so it
    // grows to fit exactly what's rendered, wraps included.
    const codeHeight = fitContent ? 'auto' : '100%';
    return (
      <div className={cx(styles.codeContainer, fitContent && styles.codeContainerFit)} data-testid="TextNGPanel-code">
        <TextNGCodeView
          content={content}
          language={codeOptions.language}
          showLineNumbers={codeOptions.showLineNumbers ?? false}
          height={codeHeight}
        />
      </div>
    );
  }

  const rendered = (
    <DangerouslySetHtmlContent
      allowRerender
      html={content}
      className={cx('markdown-html', fitContent ? styles.markdownHtmlFit : styles.markdownHtml)}
      data-testid="TextNGPanel-converted-content"
    />
  );

  // Fit-content: render in normal flow so the markdown/HTML defines the height.
  // No size containment and no inner scroll — the cell's CSS bounds the result.
  if (fitContent) {
    return rendered;
  }

  return (
    <div className={styles.containStrict}>
      <ScrollContainer minHeight="100%">{rendered}</ScrollContainer>
    </div>
  );
}

// Only mounted while the lazy editor chunk loads, so the extra processing runs
// at most once per edit session.
function EditorLoadingFallback({
  options,
  series,
  replaceVariables,
}: {
  options: Options;
  series: DataFrame[];
  replaceVariables: InterpolateFunction;
}) {
  const theme = useTheme2();
  const layout = useStyles2(getEditorLayoutStyles);
  const rendered = useMemo(
    () => renderPanelContent(options, series, replaceVariables),
    [options, series, replaceVariables]
  );
  const isCode = options.mode === TextMode.Code;

  return (
    <div className={layout.wrapper}>
      <Stack minHeight={theme.components.height.md} />
      <div className={layout.body}>
        <div className={cx(layout.pane, layout.previewPane, !isCode && layout.htmlPreviewPane)}>
          <TextNGView {...rendered} code={options.code} />
        </div>
      </div>
      {isCode && <Stack minHeight={theme.components.height.md} />}
    </div>
  );
}

function applyEditorChange(options: Options, change: TextNGEditorChange): Options {
  const { content, mode = options.mode, codeLanguage, showLineNumbers } = change;

  if (codeLanguage === undefined && showLineNumbers === undefined) {
    return { ...options, content, mode };
  }

  const code: CodeOptions = {
    showMiniMap: false,
    ...options.code,
    language: codeLanguage ?? options.code?.language ?? defaultCodeLanguage,
    showLineNumbers: showLineNumbers ?? options.code?.showLineNumbers ?? false,
  };

  return { ...options, content, mode, code };
}

function renderPanelContent(
  options: Options,
  series: DataFrame[],
  replaceVariables: InterpolateFunction
): ProcessedContent {
  return {
    mode: options.mode,
    ...catchTemplateError(() =>
      renderContent(
        {
          content: options.content ?? '',
          mode: options.mode,
          series,
          renderMode: options.renderMode,
          format: getInterpolateFormat(options.mode, options.code?.language),
        },
        replaceVariables,
        config.disableSanitizeHtml
      )
    ),
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  containStrict: css({
    contain: 'strict',
    height: '100%',
    display: 'flex',
  }),
  markdownHtml: css({
    height: '100%',
  }),
  // Flow layout for fit-content mode: no size containment, no fixed height, so
  // the content defines the panel's height.
  markdownHtmlFit: css({
    height: 'auto',
  }),
  codeContainer: css({
    height: '100%',
    overflow: 'hidden',
    // CodeMirror's wrapper div has no height of its own, so without this the
    // editor grows past the panel instead of scrolling internally
    'div:has(> .cm-editor)': {
      height: '100%',
    },
  }),
  // Fit-content: let CodeMirror's explicit pixel height (see estimateCodeHeight)
  // define the container instead of forcing it to fill the panel.
  codeContainerFit: css({
    height: 'auto',
    overflow: 'visible',
    'div:has(> .cm-editor)': {
      height: 'auto',
    },
  }),
});
