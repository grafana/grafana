// Libraries
import React, { PureComponent } from 'react';
import Remarkable from 'remarkable';
import { debounce } from 'lodash';

// Utils
import { sanitize } from 'app/core/utils/text';
import config from 'app/core/config';

// Types
import { TextOptions } from './types';
import { PanelProps } from '@grafana/ui/src/types';

interface Props extends PanelProps<TextOptions> {}
interface State {
  html: string;
}

export class TextPanel extends PureComponent<Props, State> {
  remarkable: Remarkable;

  constructor(props) {
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

    html = config.disableSanitizeHtml ? html : sanitize(html);

    return replaceVariables(html);
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
    if (!this.remarkable) {
      this.remarkable = new Remarkable();
    }
    return this.prepareHTML(this.remarkable.render(content));
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

    return <div className="markdown-html panel-text-content" dangerouslySetInnerHTML={{ __html: html }} />;
  }
}
