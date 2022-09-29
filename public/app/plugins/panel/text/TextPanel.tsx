// Libraries
import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { debounce } from 'lodash';
import React, { PureComponent } from 'react';

import { GrafanaTheme2, PanelProps, renderTextPanelMarkdown, textUtil } from '@grafana/data';
// Utils
import { CustomScrollbar, CodeEditor, stylesFactory, ThemeContext } from '@grafana/ui';
import config from 'app/core/config';

// Types
import { defaultCodeOptions, PanelOptions, TextMode } from './models.gen';

export interface Props extends PanelProps<PanelOptions> {}

interface State {
  html: string;
}

export class TextPanel extends PureComponent<Props, State> {
  static contextType = ThemeContext;

  constructor(props: Props) {
    super(props);

    this.state = {
      html: this.processContent(props.options),
    };
  }

  updateHTML = debounce(() => {
    const html = this.processContent(this.props.options);
    if (html !== this.state.html) {
      this.setState({ html });
    }
  }, 150);

  componentDidUpdate(prevProps: Props) {
    // Since any change could be referenced in a template variable,
    // This needs to process every time (with debounce)
    this.updateHTML();
  }

  prepareHTML(html: string): string {
    const result = this.interpolateString(html);
    return config.disableSanitizeHtml ? result : this.sanitizeString(result);
  }

  prepareMarkdown(content: string): string {
    // Always interpolate variables before converting to markdown
    // because `marked` replaces '{' and '}' in URLs with '%7B' and '%7D'
    // See https://marked.js.org/demo
    let result = this.interpolateString(content);

    if (config.disableSanitizeHtml) {
      result = renderTextPanelMarkdown(result, {
        noSanitize: true,
      });
      return result;
    }

    result = renderTextPanelMarkdown(result);
    return this.sanitizeString(result);
  }

  interpolateString(content: string): string {
    const { replaceVariables, options } = this.props;
    return replaceVariables(content, {}, options.code?.language === 'json' ? 'json' : 'html');
  }

  sanitizeString(content: string): string {
    return textUtil.sanitizeTextPanelContent(content);
  }

  processContent(options: PanelOptions): string {
    const { mode, content } = options;

    if (!content) {
      return '';
    }

    if (mode === TextMode.HTML) {
      return this.prepareHTML(content);
    } else if (mode === TextMode.Code) {
      return this.interpolateString(content);
    }

    return this.prepareMarkdown(content);
  }

  render() {
    const { html } = this.state;
    const { options } = this.props;
    const styles = getStyles(this.context);

    if (options.mode === TextMode.Code) {
      const { width, height } = this.props;
      const code = options.code ?? defaultCodeOptions;
      return (
        <CodeEditor
          key={`${code.showLineNumbers}/${code.showMiniMap}`} // will reinit-on change
          value={html}
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
        <DangerouslySetHtmlContent html={html} className={styles.markdown} data-testid="TextPanel-converted-content" />
      </CustomScrollbar>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
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
}));
