import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { NavModel, SelectableValue } from '@grafana/data';
import { LivePanel } from './LivePanel';
import { Select, Input, Button } from '@grafana/ui';
import { getGrafanaLiveSrv } from '@grafana/runtime';

interface Props {
  navModel: NavModel;
}

interface State {
  channel: string;
  text: string;
}

export class LiveAdmin extends PureComponent<Props, State> {
  state: State = {
    channel: 'example',
    text: '', // publish text to a channel
  };

  onChannelChanged = (v: SelectableValue<string>) => {
    if (v.value) {
      this.setState({
        channel: v.value,
      });
    }
  };

  onTextChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ text: event.target.value });
  };

  onPublish = () => {
    const { text, channel } = this.state;
    if (text) {
      const msg = {
        line: text,
      };

      const srv = getGrafanaLiveSrv();
      console.log('PUBLISHING', msg, channel, srv);
      srv.publish(channel, msg).then(v => {
        console.log('PUBLISHED', text, v);
      });
    }
    this.setState({ text: '' });
  };

  render() {
    const { navModel } = this.props;
    const { channel, text } = this.state;

    const channels: Array<SelectableValue<string>> = [
      {
        label: 'example',
        value: 'example',
        description: 'Sample event that updates periodically',
      },
    ];
    let current = channels.find(f => f.value === channel);
    if (!current) {
      current = {
        label: channel,
        value: channel,
      };
      channels.push(current);
    }

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <h2>Channels</h2>
          <Select options={channels} value={current} onChange={this.onChannelChanged} allowCustomValue={true} />
          <br />

          <LivePanel channel={channel} />

          <br />
          <br />
          <h3>Write to channel</h3>
          <Input value={text} onChange={this.onTextChanged} />
          <Button onClick={this.onPublish}>Publish</Button>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'live'),
});

export default hot(module)(connect(mapStateToProps)(LiveAdmin));
