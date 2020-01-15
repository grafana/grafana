// Libraries
import React, { PureComponent, ChangeEvent } from 'react';
import { debounce } from 'lodash';
import { renderMarkdown } from '@grafana/data';

// Utils
import { sanitize } from 'app/core/utils/text';
import config from 'app/core/config';

// Types
import { TextOptions } from './types';
import { PanelProps } from '@grafana/data';
import { Button } from '@grafana/ui';
import { getLocationSrv } from '@grafana/runtime';

interface Props extends PanelProps<TextOptions> {}
interface State {
  html: string;
  vars: string;
}

const NOW_KEY = '%NOW%';

export class TextPanel extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      html: this.processContent(props.options),
      vars: JSON.stringify(
        {
          'var-test': NOW_KEY,
          'var-test2': 'something else',
        },
        null,
        2
      ),
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

  onVarsChanged = (evt: ChangeEvent<HTMLTextAreaElement>) => {
    this.setState({ vars: (evt.target as any).value });
  };

  onSetVars = () => {
    try {
      const vars = JSON.parse(this.state.vars.replace(NOW_KEY, Date.now().toString()));
      console.log('SET VARS!', vars);
      getLocationSrv().update({
        partial: true,
        query: vars,
      });
    } catch (err) {
      console.error('Error settign vars', err);
    }
  };

  render() {
    const { vars } = this.state;
    const url = window.location.href.split('?')[0];
    const link = url + '?var-test=' + Date.now();

    return (
      <div>
        <div className="gf-form">
          <textarea
            style={{ width: '100%', height: 100 }}
            className="form-field"
            value={vars}
            onChange={this.onVarsChanged}
            rows={5}
          />
        </div>
        <Button onClick={this.onSetVars} variant="inverse">
          Update Query URL
        </Button>
        <a href={link}>just a link</a>
      </div>
    );
  }
}
