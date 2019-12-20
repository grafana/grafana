import React, { PureComponent } from 'react';
import { FormField, PanelOptionsGroup } from '@grafana/ui';
import { PanelEditorProps } from '@grafana/data';
import { NewsOptions } from './types';
import { Switch } from '@grafana/ui';

interface State {
  feedUrl: string;
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

  onProxyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.props.onOptionsChange({
      ...this.props.options,
      proxy: e.target.checked,
    });
  };

  render() {
    const { feedUrl } = this.state;
    const { proxy } = this.props.options;

    return (
      <>
        <PanelOptionsGroup title="Feed">
          <div className="gf-form">
            <FormField
              label="URL"
              labelWidth={4}
              inputWidth={25}
              value={feedUrl}
              onChange={this.onFeedUrlChange}
              onBlur={this.onUpdatePanel}
            />
            <Switch label="Proxy" checked={proxy || false} onChange={this.onProxyChange} tooltip="CORS proxy" />
          </div>
        </PanelOptionsGroup>
      </>
    );
  }
}
