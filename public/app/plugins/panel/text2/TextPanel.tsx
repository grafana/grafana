// Libraries
import { Unsubscribable } from 'rxjs';
import React, { PureComponent } from 'react';
import { debounce } from 'lodash';
import { renderMarkdown } from '@grafana/data';

// Utils
import { sanitize } from 'app/core/utils/text';
import config from 'app/core/config';

// Types
import { TextOptions } from './types';
import { PanelProps, PanelHoverEvent, PanelHoverEventPayload } from '@grafana/data';

interface Props extends PanelProps<TextOptions> {}

interface State {
  html: string;
  hover: PanelHoverEventPayload | null;
}

export class TextPanel extends PureComponent<Props, State> {
  subscription: Unsubscribable;

  constructor(props: Props) {
    super(props);

    this.state = {
      html: this.processContent(props.options),
      hover: null,
    };
  }

  updateHTML = debounce(() => {
    const html = this.processContent(this.props.options);
    if (html !== this.state.html) {
      this.setState({ html });
    }
  }, 150);

  componentDidMount() {
    this.props.eventBus.on(PanelHoverEvent, event => {
      this.setState({ hover: event.payload });
    });
  }

  componentDidUpdate(prevProps: Props) {
    // Since any change could be referenced in a template variable,
    // This needs to process everytime (with debounce)
    this.updateHTML();
  }

  prepareHTML(html: string): string {
    const { replaceVariables } = this.props;

    html = replaceVariables(html, {}, 'html');

    return config.disableSanitizeHtml ? html : sanitize(html);
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

  onMouseEnter = () => {
    this.props.eventBus.emit(
      new PanelHoverEvent({
        panelId: 10,
        pos: { x: 10, y: 15 },
      })
    );
  };

  render() {
    const { html, hover } = this.state;

    return (
      <div onMouseMove={this.onMouseEnter}>
        <div className="markdown-html panel-text-content" dangerouslySetInnerHTML={{ __html: html }} />
        {hover && (
          <table>
            <tbody>
              <tr>
                <th>x</th>
                <th>y</th>
              </tr>
              <tr>
                <td>{hover.pos.x}</td>
                <td>{hover.pos.y}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    );
  }
}
