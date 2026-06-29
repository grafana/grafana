import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { useState } from 'react';
import { useDebounce } from 'react-use';

import {
  type GrafanaTheme2,
  type PanelProps,
  renderTextPanelMarkdown,
  textUtil,
  type InterpolateFunction,
} from '@grafana/data';
import { CodeEditor, ScrollContainer, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';

import { defaultCodeOptions, type Options, TextMode } from './panelcfg.gen';

export interface Props extends PanelProps<Options> {}

export function TextPanel(props: Props) {
  const styles = useStyles2(getStyles);
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

  if (processed.mode === TextMode.Code) {
    const code = props.options.code ?? defaultCodeOptions;
    // Monaco needs an explicit height. In fit-content mode there is none, so
    // approximate from the line count (the cell's CSS max-height caps it).
    const codeHeight = props.fitContent ? estimateCodeHeight(processed.content) : props.height;
    return (
      <CodeEditor
        key={`${code.showLineNumbers}/${code.showMiniMap}`} // will reinit-on change
        value={processed.content}
        language={code.language ?? defaultCodeOptions.language!}
        width={props.width}
        height={codeHeight}
        containerStyles={styles.codeEditorContainer}
        showMiniMap={code.showMiniMap}
        showLineNumbers={code.showLineNumbers}
        readOnly={true} // future
      />
    );
  }

  const content = (
    <DangerouslySetHtmlContent
      allowRerender
      html={processed.content}
      className={cx('markdown-html', styles.markdownHtml)}
      data-testid="TextPanel-converted-content"
    />
  );

  // Fit-content: render in normal flow so the markdown defines the height. No
  // size containment and no inner scroll — the cell's CSS bounds the result.
  if (props.fitContent) {
    return <div className={cx('markdown-html', styles.markdownHtmlFit)}>{content}</div>;
  }

  return (
    <div className={styles.containStrict}>
      <ScrollContainer minHeight="100%">{content}</ScrollContainer>
    </div>
  );
}

const CODE_LINE_HEIGHT = 18;
const CODE_VERTICAL_PADDING = 16;

function estimateCodeHeight(content: string): number {
  const lines = content ? content.split('\n').length : 1;
  return lines * CODE_LINE_HEIGHT + CODE_VERTICAL_PADDING;
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
  codeEditorContainer: css({
    '.monaco-editor .margin, .monaco-editor-background': {
      backgroundColor: theme.colors.background.primary,
    },
  }),
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
});
