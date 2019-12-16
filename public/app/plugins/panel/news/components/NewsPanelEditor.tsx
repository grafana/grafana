import React, { PureComponent } from 'react';
import { FormField, PanelOptionsGroup } from '@grafana/ui';
import { PanelEditorProps } from '@grafana/data';
import { NewsOptions } from '../types';

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

  render() {
    const { feedUrl } = this.state;

    return (
      <>
        <PanelOptionsGroup title="Feed">
          <div className="gf-form">
            <FormField
              label="Feed url"
              labelWidth={6}
              inputWidth={25}
              value={feedUrl}
              onChange={this.onFeedUrlChange}
              onBlur={this.onUpdatePanel}
            />
          </div>
        </PanelOptionsGroup>
      </>
    );
  }
}
