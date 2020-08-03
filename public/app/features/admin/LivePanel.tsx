import React, { PureComponent } from 'react';
import { Unsubscribable, PartialObserver } from 'rxjs';
import { getGrafanaLiveSrv } from '@grafana/runtime';

interface Props {
  channel: string;
}

interface State {
  connected: boolean;
  count: number;
  lastTime: number;
  lastBody: string;
}

export class LivePanel extends PureComponent<Props, State> {
  state: State = {
    connected: false,
    count: 0,
    lastTime: 0,
    lastBody: '',
  };
  subscription?: Unsubscribable;

  observer: PartialObserver<any> = {
    next: (msg: any) => {
      this.setState({
        count: this.state.count + 1,
        lastTime: Date.now(),
        lastBody: JSON.stringify(msg),
      });
    },
  };

  startSubscription = () => {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }

    const srv = getGrafanaLiveSrv();
    if (srv.isConnected()) {
      const stream = srv.getChannelStream(this.props.channel);
      this.subscription = stream.subscribe(this.observer);
      this.setState({ connected: true, count: 0, lastTime: 0, lastBody: '' });
      return;
    }
    console.log('Not yet connected... try again...');
    setTimeout(this.startSubscription, 200);
  };

  componentDidMount = () => {
    this.startSubscription();
  };

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
  }

  componentDidUpdate(oldProps: Props) {
    if (oldProps.channel !== this.props.channel) {
      this.startSubscription();
    }
  }

  render() {
    const { lastBody, lastTime, count } = this.state;

    return (
      <div>
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
