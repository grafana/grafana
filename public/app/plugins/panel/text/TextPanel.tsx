import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import React, { useState } from 'react';
import { useDebounce } from 'react-use';

import { GrafanaTheme2, PanelProps, renderTextPanelMarkdown, textUtil, InterpolateFunction } from '@grafana/data';
import { CustomScrollbar, CodeEditor, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';

import { defaultCodeOptions, Options, TextMode } from './panelcfg.gen';

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
    <CustomScrollbar autoHeightMin="100%">
      <DangerouslySetHtmlContent
        html={processed.content}
        className={styles.markdown}
        data-testid="TextPanel-converted-content"
      />
    </CustomScrollbar>
  );
}

function processContent(options: Options, interpolate: InterpolateFunction, disableSanitizeHtml: boolean): string {
  let { mode, content } = options;
  if (!content) {
    return '';
  }

  // Variables must be interpolated before content is converted to markdown so using variables
  // in URLs work properly
  content = interpolate(content, {}, options.code?.language === 'json' ? 'json' : 'html');

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
  codeEditorContainer: css`
    .monaco-editor .margin,
    .monaco-editor-background {
      background-color: ${theme.colors.background.primary};
    }
  `,
  markdown: cx(
    'markdown-html',
    css`
      height: 100%;
    `
  ),
});
