import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { debounce } from 'lodash';
import React, { useEffect, useState, useCallback } from 'react';

import { GrafanaTheme2, PanelProps, renderTextPanelMarkdown, textUtil, InterpolateFunction } from '@grafana/data';
import { CustomScrollbar, CodeEditor, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';

import { defaultCodeOptions, PanelOptions, TextMode } from './models.gen';

export interface Props extends PanelProps<PanelOptions> {}

export function TextPanel({ options, replaceVariables, width, height }: Props) {
  const styles = useStyles2(getStyles);
  const [clean, setClean] = useState<PanelOptions>(
    processContent(options, replaceVariables, config.disableSanitizeHtml)
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const processText = useCallback(
    debounce((opts: PanelOptions) => {
      setClean(processContent(opts, replaceVariables, config.disableSanitizeHtml));
    }, 150),
    [replaceVariables]
  );

  // When options change update the text (debounced)
  useEffect(() => processText(options), [options, processText]);

  if (clean.mode === TextMode.Code) {
    const code = options.code ?? defaultCodeOptions;
    return (
      <CodeEditor
        key={`${code.showLineNumbers}/${code.showMiniMap}`} // will reinit-on change
        value={clean.content}
        language={code.language ?? defaultCodeOptions.language!}
        width={width}
        height={height}
        containerStyles={styles.codeEditorContainer}
        showMiniMap={code.showMiniMap}
        showLineNumbers={code.showLineNumbers}
        readOnly={true} // future
      />
    );
  }

  return (
    <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
      <DangerouslySetHtmlContent
        html={clean.content}
        className={styles.markdown}
        data-testid="TextPanel-converted-content"
      />
    </CustomScrollbar>
  );
}

export function processContent(
  options: PanelOptions,
  interpolate: InterpolateFunction,
  disableSanitizeHtml: boolean
): PanelOptions {
  let { mode, content } = options;
  if (content) {
    content = interpolate(content, {}, options.code?.language === 'json' ? 'json' : 'html');
  } else {
    content = '';
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
      if (disableSanitizeHtml) {
        content = renderTextPanelMarkdown(content, {
          noSanitize: true,
        });
      } else {
        content = textUtil.sanitizeTextPanelContent(renderTextPanelMarkdown(content));
      }
  }

  return {
    content, // direct value, not sanitized
    mode,
  };
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
