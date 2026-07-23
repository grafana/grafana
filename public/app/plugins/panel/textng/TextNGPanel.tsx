import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { lazy, Suspense, useState } from 'react';
import { useDebounce } from 'react-use';

import {
  CoreApp,
  type GrafanaTheme2,
  type PanelProps,
  renderTextPanelMarkdown,
  textUtil,
  type InterpolateFunction,
} from '@grafana/data';
import { ScrollContainer, usePanelContext, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';

import { defaultCodeOptions, defaultOptions, type Options, TextMode } from '../../schemas/textng/panelcfg.gen';

const TextNGEditor = lazy(() => import('./TextNGEditor').then((m) => ({ default: m.TextNGEditor })));
const TextNGCodeView = lazy(() => import('./TextNGCodeView').then((m) => ({ default: m.TextNGCodeView })));

export interface Props extends PanelProps<Options> {}

export function TextNGPanel(props: Props) {
  const styles = useStyles2(getStyles);
  const { app } = usePanelContext();
  const { options, onOptionsChange, replaceVariables } = props;
  const isEditing = app === CoreApp.PanelEditor;
  const content = options.content ?? defaultOptions.content ?? '';

  const interpolatedContent = isEditing ? '' : interpolateContent(options, replaceVariables);

  const [processed, setProcessed] = useState<Options>(() => ({
    mode: options.mode,
    content: transformContent(options.mode, interpolatedContent, config.disableSanitizeHtml),
  }));

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
      <Suspense fallback={null}>
        <TextNGEditor
          content={content}
          mode={options.mode}
          showLineNumbers={options.code?.showLineNumbers ?? false}
          codeLanguage={options.code?.language}
          replaceVariables={replaceVariables}
          onChange={(next) => onOptionsChange({ ...options, content: next })}
        />
      </Suspense>
    );
  }

  if (processed.mode === TextMode.Code) {
    const code = options.code ?? defaultCodeOptions;
    const plainFallback = (
      <ScrollContainer minHeight="100%">
        <pre className={styles.codeContent}>{processed.content}</pre>
      </ScrollContainer>
    );
    return (
      <div className={styles.codeContainer} data-testid="TextNGPanel-code">
        <Suspense fallback={plainFallback}>
          <TextNGCodeView
            content={processed.content}
            language={code.language}
            showLineNumbers={code.showLineNumbers ?? false}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className={styles.containStrict}>
      <ScrollContainer minHeight="100%">
        <DangerouslySetHtmlContent
          allowRerender
          html={processed.content}
          className={cx('markdown-html', styles.markdownHtml)}
          data-testid="TextNGPanel-converted-content"
        />
      </ScrollContainer>
    </div>
  );
}

function interpolateContent(options: Options, interpolate: InterpolateFunction): string {
  return interpolate(options.content ?? '', {}, options.code?.language === 'json' ? 'json' : 'html');
}

function transformContent(mode: TextMode, content: string, disableSanitizeHtml: boolean): string {
  if (!content) {
    return ' ';
  }

  switch (mode) {
    case TextMode.Code:
      break;
    case TextMode.HTML:
      if (!disableSanitizeHtml) {
        content = textUtil.sanitizeTextPanelContent(content);
      }
      break;
    case TextMode.Markdown:
    default:
      content = renderTextPanelMarkdown(content, {
        noSanitize: disableSanitizeHtml,
      });
  }

  return content;
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
  codeContent: css({
    margin: 0,
    padding: theme.spacing(1),
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
});
