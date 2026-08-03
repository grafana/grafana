import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import { CoreApp, type GrafanaTheme2, type PanelProps, type InterpolateFunction } from '@grafana/data';
import { ScrollContainer, usePanelContext, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { getDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { type CodeOptions, defaultCodeOptions, defaultOptions, type Options, TextMode } from '../panelcfg.gen';

import { TextNGCodeView } from './TextNGCodeView';
import { type TextNGEditorChange } from './editor/TextNGEditor';
import { getInterpolateFormat, transformContent } from './utils';

const TextNGEditor = lazy(() => import('./editor/TextNGEditor').then((m) => ({ default: m.TextNGEditor })));

export interface Props extends PanelProps<Options> {}

export function TextNGPanel(props: Props) {
  const { app } = usePanelContext();
  const { options, onOptionsChange, replaceVariables, data } = props;
  const isEditing = app === CoreApp.PanelEditor;
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
    return (
      // Show the rendered content while the editor chunk loads; the editor
      // opens in Preview view, so the content stays in place.
      <Suspense fallback={<EditorLoadingFallback options={options} replaceVariables={replaceVariables} />}>
        <TextNGEditor
          content={content}
          mode={options.mode}
          showLineNumbers={options.code?.showLineNumbers ?? false}
          codeLanguage={options.code?.language}
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
  replaceVariables,
}: {
  options: Options;
  replaceVariables: InterpolateFunction;
}) {
  const content = useMemo(
    () => transformContent(options.mode, interpolateContent(options, replaceVariables), config.disableSanitizeHtml),
    [options, replaceVariables]
  );

  return <TextNGView mode={options.mode} content={content} code={options.code} />;
}

function applyEditorChange(options: Options, change: TextNGEditorChange): Options {
  const { content, mode = options.mode, codeLanguage } = change;
  const code: CodeOptions | undefined = codeLanguage
    ? { showLineNumbers: false, showMiniMap: false, ...options.code, language: codeLanguage }
    : options.code;

  return { ...options, content, mode, code };
}

function interpolateContent(options: Options, interpolate: InterpolateFunction): string {
  return interpolate(options.content ?? '', {}, getInterpolateFormat(options.code?.language));
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
  }),
});
