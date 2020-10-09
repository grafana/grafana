import React, { PureComponent } from 'react';
import { Unsubscribable, PartialObserver } from 'rxjs';
import { CustomScrollbar, FeatureInfoBox, Label } from '@grafana/ui';
import {
  PanelProps,
  LiveChannelStatusEvent,
  isValidLiveChannelAddress,
  LiveChannel,
  LiveChannelEvent,
  isLiveChannelStatusEvent,
  isLiveChannelMessageEvent,
} from '@grafana/data';
import { LivePanelOptions } from './types';
import { getGrafanaLiveSrv } from '@grafana/runtime';

interface Props extends PanelProps<LivePanelOptions> {}

interface State {
  error?: any;
  channel?: LiveChannel;
  status?: LiveChannelStatusEvent;
  message?: any;
}

export class LivePanel extends PureComponent<Props, State> {
  private readonly isValid: boolean;
  subscription?: Unsubscribable;

  constructor(props: Props) {
    super(props);

    this.isValid = !!getGrafanaLiveSrv();
    this.state = {};
  }

  async componentDidMount() {
    this.loadChannel();
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.props.options?.channel !== prevProps.options?.channel) {
      this.loadChannel();
    }
  }

  streamObserver: PartialObserver<LiveChannelEvent> = {
    next: (event: LiveChannelEvent) => {
      if (isLiveChannelStatusEvent(event)) {
        this.setState({ status: event });
      } else if (isLiveChannelMessageEvent(event)) {
        this.setState({ message: event.message });
      } else {
        console.log('ignore', event);
      }
    },
  };

  unsubscribe = () => {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
  };

  async loadChannel() {
    const addr = this.props.options?.channel;
    if (!isValidLiveChannelAddress(addr)) {
      console.log('INVALID', addr);
      this.unsubscribe();
      this.setState({
        channel: undefined,
      });
      return;
    }

    const channel = getGrafanaLiveSrv().getChannel(addr);
    const changed = channel.id !== this.state.channel?.id;
    console.log('LOAD', addr, changed, channel);
    if (changed) {
      this.unsubscribe();

      // Subscribe to new events
      try {
        this.subscription = channel.getStream().subscribe(this.streamObserver);
        this.setState({ channel, error: undefined });
      } catch (err) {
        this.setState({ channel: undefined, error: err });
      }
    } else {
      console.log('Same channel', channel);
    }
  }

  renderNotEnabled() {
    const preformatted = `[feature_toggles]
    enable = live`;
    return (
      <FeatureInfoBox
        title="Grafana Live"
        style={{
          height: this.props.height,
        }}
      >
        <p>Grafana live requires a feature flag to run</p>

        <b>custom.ini:</b>
        <pre>{preformatted}</pre>
      </FeatureInfoBox>
    );
  }

  render() {
    if (!this.isValid) {
      return this.renderNotEnabled();
    }
    const { channel, status, message, error } = this.state;
    if (!channel) {
      return (
        <FeatureInfoBox
          title="Grafana Live"
          style={{
            height: this.props.height,
          }}
        >
          <p>Use the panel editor to pick a channel</p>
        </FeatureInfoBox>
      );
    }

    if (error) {
      return (
        <div>
          <h2>ERROR</h2>
          <div>{JSON.stringify(error)}</div>
        </div>
      );
    }

    return (
      <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
        <Label>Status</Label>
        <pre>{JSON.stringify(status)}</pre>

        <br />
        <Label>Message</Label>
        <pre>{JSON.stringify(message)}</pre>
      </CustomScrollbar>
    );
  }
}
