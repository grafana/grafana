import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, PanelProps, renderTextPanelMarkdown, textUtil, InterpolateFunction } from '@grafana/data';
import { CustomScrollbar, CodeEditor, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';

import { defaultCodeOptions, PanelOptions, TextMode } from './models.gen';

export interface Props extends PanelProps<PanelOptions> {}

export function TextPanel({ options, replaceVariables, width, height }: Props) {
  const styles = useStyles2(getStyles);
  const location = useLocation();

  const processed = useMemo(() => {
    return processContent(options, replaceVariables, config.disableSanitizeHtml);
    // include "location" since it will updat whenever variables change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, replaceVariables, location]);

  if (options.mode === TextMode.Code) {
    const code = options.code ?? defaultCodeOptions;
    return (
      <CodeEditor
        key={`${code.showLineNumbers}/${code.showMiniMap}`} // will reinit-on change
        value={processed}
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
    <CustomScrollbar autoHeightMin="100%">
      <DangerouslySetHtmlContent
        html={processed}
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
): string {
  let { mode, content } = options;
  if (!content) {
    return '';
  }

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
