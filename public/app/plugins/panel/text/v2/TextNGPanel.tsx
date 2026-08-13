import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import { CoreApp, type DataFrame, type GrafanaTheme2, type PanelProps, type InterpolateFunction } from '@grafana/data';
import { ScrollContainer, Stack, usePanelContext, useStyles2, useTheme2 } from '@grafana/ui';
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
import { type TextNGEditorChange } from './editor/TextNGEditor';
import { getEditorLayoutStyles } from './editor/editorLayout';
import { renderContent } from './renderContent';
import { EMPTY_CONTENT, getInterpolateFormat } from './utils';

const TextNGEditor = lazy(() => import('./editor/TextNGEditor').then((m) => ({ default: m.TextNGEditor })));

export interface Props extends PanelProps<Options> {}

export function TextNGPanel(props: Props) {
  const { app } = usePanelContext();
  const { options, onOptionsChange, replaceVariables, data, renderCounter } = props;
  const isEditing = app === CoreApp.PanelEditor;
  const content = options.content ?? defaultOptions.content ?? '';

  const suggestions = useMemo(
    () => (isEditing ? getDataLinksVariableSuggestions(data.series) : []),
    [isEditing, data.series]
  );

  const [processed, setProcessed] = useState<Options>(() => ({
    mode: options.mode,
    // The editor renders its own preview, so skip the render pass on entry.
    content: isEditing ? EMPTY_CONTENT : renderPanelContent(options, data.series, replaceVariables),
  }));

  // Recompute synchronously when leaving edit mode so pre-edit content never flashes.
  const [wasEditing, setWasEditing] = useState(isEditing);
  if (wasEditing !== isEditing) {
    setWasEditing(isEditing);
    if (!isEditing) {
      setProcessed({
        mode: options.mode,
        content: renderPanelContent(options, data.series, replaceVariables),
      });
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
      const next = renderPanelContent(options, data.series, replaceVariables);
      if (next !== processed.content || options.mode !== processed.mode) {
        setProcessed({
          mode: options.mode,
          content: next,
        });
      }
    },
    100,
    [
      isEditing,
      options.content,
      options.mode,
      options.renderMode,
      options.code?.language,
      data.series,
      replaceVariables,
      renderCounter,
    ]
  );

  if (isEditing) {
    return (
      // Show the rendered content while the editor chunk loads; the editor
      // opens in Preview view, so the content stays in place.
      <Suspense
        fallback={<EditorLoadingFallback options={options} series={data.series} replaceVariables={replaceVariables} />}
      >
        <TextNGEditor
          content={content}
          mode={options.mode}
          showLineNumbers={options.code?.showLineNumbers ?? false}
          codeLanguage={options.code?.language}
          renderMode={options.renderMode}
          series={data.series}
          replaceVariables={replaceVariables}
          suggestions={suggestions}
          onChange={(change) => onOptionsChange(applyEditorChange(options, change))}
        />
      </Suspense>
    );
  }

  return <TextNGView mode={processed.mode} content={processed.content} code={options.code} />;
}

interface TextNGViewProps {
  mode: TextMode;
  content: string;
  code: Options['code'];
}

function TextNGView({ mode, content, code }: TextNGViewProps) {
  const styles = useStyles2(getStyles);

  if (mode === TextMode.Code) {
    const codeOptions = code ?? defaultCodeOptions;
    return (
      <div className={styles.codeContainer} data-testid="TextNGPanel-code">
        <TextNGCodeView
          content={content}
          language={codeOptions.language}
          showLineNumbers={codeOptions.showLineNumbers ?? false}
        />
      </div>
    );
  }

  return (
    <div className={styles.containStrict}>
      <ScrollContainer minHeight="100%">
        <DangerouslySetHtmlContent
          allowRerender
          html={content}
          className={cx('markdown-html', styles.markdownHtml)}
          data-testid="TextNGPanel-converted-content"
        />
      </ScrollContainer>
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
  const content = useMemo(
    () => renderPanelContent(options, series, replaceVariables),
    [options, series, replaceVariables]
  );
  const isCode = options.mode === TextMode.Code;

  return (
    <div className={layout.wrapper}>
      <Stack minHeight={theme.components.height.md} />
      <div className={layout.body}>
        <div className={cx(layout.pane, layout.previewPane, !isCode && layout.htmlPreviewPane)}>
          <TextNGView mode={options.mode} content={content} code={options.code} />
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

function renderPanelContent(options: Options, series: DataFrame[], replaceVariables: InterpolateFunction): string {
  return renderContent(
    {
      content: options.content ?? '',
      mode: options.mode,
      series,
      renderMode: options.renderMode,
      format: getInterpolateFormat(options.code?.language),
    },
    replaceVariables,
    config.disableSanitizeHtml
  );
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
  codeContainer: css({
    height: '100%',
    overflow: 'hidden',
    // CodeMirror's wrapper div has no height of its own, so without this the
    // editor grows past the panel instead of scrolling internally
    'div:has(> .cm-editor)': {
      height: '100%',
    },
  }),
});
