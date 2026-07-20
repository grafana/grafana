import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';

import { CoreApp, type GrafanaTheme2, type PanelProps, renderTextPanelMarkdown, textUtil } from '@grafana/data';
import { ScrollContainer, usePanelContext, useStyles2 } from '@grafana/ui';

import { TextNGEditor } from './TextNGEditor';
import { defaultOptions, type Options, TextMode } from './panelcfg.gen';

export function TextNGPanel({ options, onOptionsChange, height }: PanelProps<Options>) {
  const styles = useStyles2(getStyles);
  const { app } = usePanelContext();

  const content = options.content ?? defaultOptions.content ?? '';

  // In panel edit mode, take over the canvas with the inline editor.
  if (app === CoreApp.PanelEditor) {
    return (
      <TextNGEditor
        content={content}
        mode={options.mode}
        wordWrap={options.wordWrap ?? true}
        showLineNumbers={options.code?.showLineNumbers ?? false}
        codeLanguage={options.code?.language}
        height={height}
        onChange={(next) => onOptionsChange({ ...options, content: next })}
      />
    );
  }

  if (options.mode === TextMode.Code) {
    return (
      <ScrollContainer minHeight="100%">
        <pre className={styles.codeContent} data-testid="TextNGPanel-code">
          {content}
        </pre>
      </ScrollContainer>
    );
  }

  const html = !content
    ? ' '
    : options.mode === TextMode.HTML
      ? textUtil.sanitizeTextPanelContent(content)
      : renderTextPanelMarkdown(content);

  return (
    <div className={styles.containStrict}>
      <ScrollContainer minHeight="100%">
        <DangerouslySetHtmlContent
          allowRerender
          html={html}
          className={cx('markdown-html', styles.markdownHtml)}
          data-testid="TextNGPanel-converted-content"
        />
      </ScrollContainer>
    </div>
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
  codeContent: css({
    margin: 0,
    padding: theme.spacing(1),
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
});
