import React, { PureComponent } from 'react';
import { FormField, PanelOptionsGroup, Button } from '@grafana/ui';
import { PanelEditorProps } from '@grafana/data';
import { NewsOptions, DEFAULT_FEED_URL } from './types';

const PROXY_PREFIX = 'https://cors-anywhere.herokuapp.com/';

interface State {
  feedUrl?: string;
}

export class NewsPanelEditor extends PureComponent<PanelEditorProps<NewsOptions>, State> {
  constructor(props: PanelEditorProps<NewsOptions>) {
    super(props);

    this.state = {
      feedUrl: props.options.feedUrl,
    };
  }

  onUpdatePanel = () =>
    this.props.onOptionsChange({
      ...this.props.options,
      feedUrl: this.state.feedUrl,
    });

  onFeedUrlChange = ({ target }: any) => this.setState({ feedUrl: target.value });

  onSetProxyPrefix = () => {
    const feedUrl = PROXY_PREFIX + this.state.feedUrl;
    this.setState({ feedUrl });
    this.props.onOptionsChange({
      ...this.props.options,
      feedUrl,
    });
  };

  render() {
    const feedUrl = this.state.feedUrl || '';
    const suggestProxy = feedUrl && !feedUrl.startsWith(PROXY_PREFIX);
    return (
      <>
        <PanelOptionsGroup title="Feed">
          <>
            <div className="gf-form">
              <FormField
                label="URL"
                labelWidth={7}
                inputWidth={30}
                value={feedUrl || ''}
                placeholder={DEFAULT_FEED_URL}
                onChange={this.onFeedUrlChange}
                tooltip="Only RSS feed formats are supported (not Atom)."
                onBlur={this.onUpdatePanel}
              />
            </div>
            {suggestProxy && (
              <div>
                <br />
                <div>If the feed is unable to connect, consider a CORS proxy</div>
                <Button variant="inverse" onClick={this.onSetProxyPrefix}>
                  Use Proxy
                </Button>
              </div>
            )}
          </>
        </PanelOptionsGroup>
      </>
    );
  }
}
