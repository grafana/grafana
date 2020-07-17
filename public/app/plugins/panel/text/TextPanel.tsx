// Libraries
import React, { PureComponent } from 'react';
import { debounce } from 'lodash';
import { PanelProps, renderMarkdown, textUtil } from '@grafana/data';
// Utils
import { getConfig } from 'app/core/config';
// Types
import { TextOptions } from './types';
import { stylesFactory } from '@grafana/ui';
import { css, cx } from 'emotion';

interface Props extends PanelProps<TextOptions> {}

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
    // This needs to process everytime (with debounce)
    this.updateHTML();
  }

  prepareHTML(html: string): string {
    const { replaceVariables } = this.props;

    html = replaceVariables(html, {}, 'html');
    if (getConfig().disableSanitizeHtml) {
      this.prepareScripts(html);
    }
    return getConfig().disableSanitizeHtml ? html : textUtil.sanitize(html);
  }

  // When html sanitization is disabled we need to process html against any inline script tag occurences
  // and eval those scripts to have an effect.
  // React's dangerouslySetInnerHTML uses innerHTML which does not evaluate scripts: https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML
  prepareScripts(html: string) {
    const tmp = new DOMParser().parseFromString(html, 'text/html');
    const scripts = tmp.getElementsByTagName('script');

    if (scripts.length > 0) {
      for (let i = 0; i < scripts.length; i++) {
        const script = scripts[0].innerText;
        if (script) {
          window.eval(script);
        }
      }
    }
  }

  prepareText(content: string): string {
    return this.prepareHTML(
      content
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;')
        .replace(/\n/g, '<br/>')
    );
  }

  prepareMarkdown(content: string): string {
    return this.prepareHTML(renderMarkdown(content));
  }

  processContent(options: TextOptions): string {
    const { mode, content } = options;

    if (!content) {
      return '';
    }

    if (mode === 'markdown') {
      return this.prepareMarkdown(content);
    }
    if (mode === 'html') {
      return this.prepareHTML(content);
    }

    return this.prepareText(content);
  }

  render() {
    const { html } = this.state;
    const styles = getStyles();
    return <div className={cx('markdown-html', styles.content)} dangerouslySetInnerHTML={{ __html: html }} />;
  }
}

const getStyles = stylesFactory(() => {
  return {
    content: css`
      height: 100%;
    `,
  };
});
