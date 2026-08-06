import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import { CoreApp, type GrafanaTheme2, type PanelProps, type InterpolateFunction } from '@grafana/data';
import { useFlagTextDashboardEditor } from '@grafana/runtime/internal';
import { ScrollContainer, Stack, usePanelContext, useStyles2, useTheme2 } from '@grafana/ui';
import { usePanelCanEditInline } from '@grafana/ui/unstable';
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
import { getInterpolateFormat, transformContent } from './utils';

const TextNGEditor = lazy(() => import('./editor/TextNGEditor').then((m) => ({ default: m.TextNGEditor })));

export interface Props extends PanelProps<Options> {}

export function TextNGPanel(props: Props) {
  const { app, inlineEdit } = usePanelContext();
  const { options, onOptionsChange, replaceVariables, data, height } = props;

  const isPanelEditor = app === CoreApp.PanelEditor;
  const isInlineEditing = usePanelCanEditInline(useFlagTextDashboardEditor() && !isPanelEditor);
  const isEditing = isPanelEditor || isInlineEditing;

  // The editor unmounts every time the panel is deselected, so the view is held here to survive
  // open/close cycles.
  const [view, setView] = useState<ViewMode | undefined>(undefined);

  useOptionsEditSession(isInlineEditing, inlineEdit?.beginOptionsEditSession);

  const content = options.content ?? defaultOptions.content ?? '';

  const interpolatedContent = isEditing ? '' : interpolateContent(options, replaceVariables);

  const suggestions = useMemo(
    () => (isEditing ? getDataLinksVariableSuggestions(data.series) : []),
    [isEditing, data.series]
  );

  const [processed, setProcessed] = useState<Options>(() => ({
    mode: options.mode,
    content: transformContent(options.mode, interpolatedContent, config.disableSanitizeHtml),
  }));

  // Recompute synchronously when leaving edit mode so pre-edit content never flashes.
  const [wasEditing, setWasEditing] = useState(isEditing);
  if (wasEditing !== isEditing) {
    setWasEditing(isEditing);
    if (!isEditing) {
      setProcessed({
        mode: options.mode,
        content: transformContent(options.mode, interpolatedContent, config.disableSanitizeHtml),
      });
    }
  }

  // Batches bursts of interpolated-content changes (data/variable refresh) so
  // the markdown/sanitize pass runs once per burst, not per intermediate value.
  useDebounce(
    () => {
      if (isEditing) {
        return;
      }
      const next = transformContent(options.mode, interpolatedContent, config.disableSanitizeHtml);
      if (next !== processed.content || options.mode !== processed.mode) {
        setProcessed({
          mode: options.mode,
          content: next,
        });
      }
    },
    100,
    [isEditing, interpolatedContent, options.mode]
  );

  if (isEditing) {
    const editor = (
      // Show the rendered content while the editor chunk loads, so the panel body keeps its shape.
      <Suspense fallback={<EditorLoadingFallback options={options} replaceVariables={replaceVariables} />}>
        <TextNGEditor
          content={content}
          mode={options.mode}
          showLineNumbers={options.code?.showLineNumbers ?? false}
          codeLanguage={options.code?.language}
          replaceVariables={replaceVariables}
          suggestions={suggestions}
          availableHeight={height}
          allowSplit={!isInlineEditing}
          defaultView={isInlineEditing ? 'write' : undefined}
          autoFocus={isInlineEditing}
          view={view}
          onViewChange={setView}
          onChange={(change) => onOptionsChange(applyEditorChange(options, change))}
        />
      </Suspense>
    );

    if (!isInlineEditing) {
      return editor;
    }

    return (
      // The panel chrome selects on any content pointer down, and re-selecting deselects, which
      // would unmount the editor mid-edit. Its exemptions cover buttons and links but not radios,
      // switches or the text surface. `display: contents` keeps the wrapper out of the layout.
      <div className={inlineEditHost} onPointerDown={(event) => event.stopPropagation()}>
        {editor}
      </div>
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
  replaceVariables,
}: {
  options: Options;
  replaceVariables: InterpolateFunction;
}) {
  const theme = useTheme2();
  const layout = useStyles2(getEditorLayoutStyles);
  const content = useMemo(
    () => transformContent(options.mode, interpolateContent(options, replaceVariables), config.disableSanitizeHtml),
    [options, replaceVariables]
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

/** Opens a host edit session while editing in place, so the whole session is one undo entry. */
function useOptionsEditSession(isInlineEditing: boolean, beginSession?: () => () => void) {
  useEffect(() => {
    if (!isInlineEditing) {
      return;
    }

    // Ends after the editor has committed its draft, since the dashboard blurs the editor before it
    // changes the selection that ends the session.
    return beginSession?.();
  }, [isInlineEditing, beginSession]);
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

function interpolateContent(options: Options, interpolate: InterpolateFunction): string {
  return interpolate(options.content ?? '', {}, getInterpolateFormat(options.code?.language));
}

const inlineEditHost = css({ display: 'contents' });

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
  }),
});
