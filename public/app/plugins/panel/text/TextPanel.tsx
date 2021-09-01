// Libraries
import React, { PureComponent } from 'react';
import { debounce } from 'lodash';
import { PanelProps, renderMarkdown, textUtil } from '@grafana/data';
// Utils
import config from 'app/core/config';
// Types
import { PanelOptions, TextMode } from './models.gen';
import { CustomScrollbar, stylesFactory } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';

interface Props extends PanelProps<PanelOptions> {}

interface State {
  html: string;
}

export class TextPanel extends PureComponent<Props, State> {
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
    return this.interpolateAndSanitizeString(html);
  }

  prepareMarkdown(content: string): string {
    // Sanitize is disabled here as we handle that after variable interpolation
    return renderMarkdown(this.interpolateAndSanitizeString(content), { noSanitize: config.disableSanitizeHtml });
  }

  interpolateAndSanitizeString(content: string): string {
    const { replaceVariables } = this.props;

    content = replaceVariables(content, {}, 'html');

    return config.disableSanitizeHtml ? content : textUtil.sanitize(content);
  }

  processContent(options: PanelOptions): string {
    const { mode, content } = options;

    if (!content) {
      return '';
    }

    if (mode === TextMode.HTML) {
      return this.prepareHTML(content);
    }

    return this.prepareMarkdown(content);
  }

  render() {
    const { html } = this.state;
    const styles = getStyles();
    return (
      <CustomScrollbar autoHeightMin="100%">
        <DangerouslySetHtmlContent html={html} className={cx('markdown-html', styles.content)} />
      </CustomScrollbar>
    );
  }
}

const getStyles = stylesFactory(() => {
  return {
    content: css`
      height: 100%;
    `,
  };
});
