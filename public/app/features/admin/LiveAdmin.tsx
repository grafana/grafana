import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { NavModel, SelectableValue, FeatureState } from '@grafana/data';
import { LivePanel } from './LivePanel';
import { Select, Input, Button, FeatureInfoBox, Container } from '@grafana/ui';
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
    channel: 'random-2s-stream',
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
        label: 'random-2s-stream',
        value: 'random-2s-stream',
        description: 'Random stream that updates every 2s',
      },
      {
        label: 'random-flakey-stream',
        value: 'random-flakey-stream',
        description: 'Random stream with intermittent updates',
      },
      {
        label: 'example-chat',
        value: 'example-chat',
        description: 'A channel that expects chat messages',
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
          <Container grow={1}>
            <FeatureInfoBox
              title="Grafana Live"
              featureState={FeatureState.alpha}
              // url={getDocsLink(DocsId.Transformations)}
            >
              <p>
                This supports real-time event streams in grafana core. This feature is under heavy development. Expect
                the intefaces and structures to change as this becomes more production ready.
              </p>
            </FeatureInfoBox>
            <br />
            <br />
          </Container>

          <h2>Channels</h2>
          <Select options={channels} value={current} onChange={this.onChannelChanged} allowCustomValue={true} />
          <br />

          <LivePanel channel={channel} />

          <br />
          <br />
          <h3>Write to channel</h3>
          <Input value={text} onChange={this.onTextChanged} />
          <Button onClick={this.onPublish} variant={text ? 'primary' : 'secondary'}>
            Publish
          </Button>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'live'),
});

export default hot(module)(connect(mapStateToProps)(LiveAdmin));
