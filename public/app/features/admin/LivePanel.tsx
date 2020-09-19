import React, { PureComponent } from 'react';
import { Unsubscribable, PartialObserver } from 'rxjs';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import { LiveChannel, LiveChannelConfig, LiveChannelScope, LiveChannelStatus } from '@grafana/data';

interface Props {
  scope: LiveChannelScope;
  namespace: string;
  path: string;
  config?: LiveChannelConfig;
}

interface State {
  channel?: LiveChannel;
  status: LiveChannelStatus;
  count: number;
  lastTime: number;
  lastBody: string;
}

export class LivePanel extends PureComponent<Props, State> {
  state: State = {
    status: { id: '?', connected: false, timestamp: Date.now() },
    count: 0,
    lastTime: 0,
    lastBody: '',
  };
  streamSubscription?: Unsubscribable;
  statusSubscription?: Unsubscribable;

  streamObserver: PartialObserver<any> = {
    next: (msg: any) => {
      this.setState({
        count: this.state.count + 1,
        lastTime: Date.now(),
        lastBody: JSON.stringify(msg),
      });
    },
  };

  statusObserver: PartialObserver<LiveChannelStatus> = {
    next: (status: LiveChannelStatus) => {
      this.setState({ status });
    },
  };

  startSubscription = () => {
    const { scope, namespace, path } = this.props;
    const channel = getGrafanaLiveSrv().getChannel(scope, namespace, path);
    if (this.state.channel === channel) {
      return; // no change!
    }

    if (this.streamSubscription) {
      this.streamSubscription.unsubscribe();
    }
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
    }

    this.streamSubscription = channel.getStream().subscribe(this.streamObserver);
    this.statusSubscription = channel.getStatus().subscribe(this.statusObserver);
    this.setState({ channel });
  };

  componentDidMount = () => {
    this.startSubscription();
  };

  componentWillUnmount() {
    if (this.streamSubscription) {
      this.streamSubscription.unsubscribe();
    }
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
    }
  }

  componentDidUpdate(oldProps: Props) {
    // if (oldProps.channel !== this.props.channel) {
    //   this.startSubscription();
    // }
  }

  render() {
    const { lastBody, lastTime, count, status } = this.state;
    const { config } = this.props;

    return (
      <div>
        <h5>Status: (config:{config ? 'true' : 'false'})</h5>
        <pre>{JSON.stringify(status)}</pre>

        <h5>Count: {count}</h5>
        {lastTime > 0 && (
          <>
            <h5>Last: {lastTime}</h5>
            {lastBody && (
              <div>
                <pre>{lastBody}</pre>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
}
