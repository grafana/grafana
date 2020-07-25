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

  startSubscriptoin = () => {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }

    const srv = getGrafanaLiveSrv();
    if (srv.isConnected()) {
      this.subscription = getGrafanaLiveSrv().subscribe<any>(this.props.channel, this.observer);
      this.setState({ connected: true, count: 0, lastTime: 0, lastBody: '' });
      return;
    }
    console.log('Not yet connected... try again...');
    setTimeout(this.startSubscriptoin, 200);
  };

  componentDidMount = () => {
    this.startSubscriptoin();
  };

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
  }

  componentDidUpdate(oldProps: Props) {
    if (oldProps.channel !== this.props.channel) {
      this.startSubscriptoin();
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
