import React, { PureComponent } from 'react';
import { Unsubscribable, PartialObserver } from 'rxjs';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import {
  AppEvents,
  isLiveChannelStatusEvent,
  LiveChannel,
  LiveChannelConfig,
  LiveChannelConnectionState,
  LiveChannelEvent,
  LiveChannelEventType,
  LiveChannelScope,
  LiveChannelStatusEvent,
} from '@grafana/data';
import { Input, Button } from '@grafana/ui';
import { appEvents } from 'app/core/core';

interface Props {
  scope: LiveChannelScope;
  namespace: string;
  path: string;
  config?: LiveChannelConfig;
}

interface State {
  channel?: LiveChannel;
  status: LiveChannelStatusEvent;
  count: number;
  lastTime: number;
  lastBody: string;
  text: string; // for publish!
}

export class LivePanel extends PureComponent<Props, State> {
  state: State = {
    status: {
      type: LiveChannelEventType.Status,
      id: '?',
      state: LiveChannelConnectionState.Pending,
      timestamp: Date.now(),
    },
    count: 0,
    lastTime: 0,
    lastBody: '',
    text: '',
  };
  subscription?: Unsubscribable;

  streamObserver: PartialObserver<LiveChannelEvent> = {
    next: (event: LiveChannelEvent) => {
      if (isLiveChannelStatusEvent(event)) {
        this.setState({ status: event });
      } else {
        this.setState({
          count: this.state.count + 1,
          lastTime: Date.now(),
          lastBody: JSON.stringify(event),
        });
      }
    },
  };

  startSubscription = () => {
    const { scope, namespace, path } = this.props;
    const channel = getGrafanaLiveSrv().getChannel(scope, namespace, path);
    if (this.state.channel === channel) {
      return; // no change!
    }

    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    this.subscription = channel.getStream().subscribe(this.streamObserver);
    this.setState({ channel });
  };

  componentDidMount = () => {
    this.startSubscription();
  };

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  componentDidUpdate(oldProps: Props) {
    if (oldProps.config !== this.props.config) {
      this.startSubscription();
    }
  }

  onTextChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ text: event.target.value });
  };

  onPublish = () => {
    const { text, channel } = this.state;
    if (text && channel) {
      const msg = {
        line: text,
      };

      channel.publish!(msg)
        .then(v => {
          console.log('PUBLISHED', text, v);
        })
        .catch(err => {
          appEvents.emit(AppEvents.alertError, ['Publish error', `${err}`]);
        });
    }
    this.setState({ text: '' });
  };

  render() {
    const { lastBody, lastTime, count, status, text } = this.state;
    const { config } = this.props;
    const showPublish = config && config.canPublish && config.canPublish();

    return (
      <div>
        <h5>Status: {config ? '' : '(no config)'}</h5>
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

        {showPublish && (
          <div>
            <h3>Write to channel</h3>
            <Input value={text} onChange={this.onTextChanged} />
            <Button onClick={this.onPublish} variant={text ? 'primary' : 'secondary'}>
              Publish
            </Button>
          </div>
        )}
      </div>
    );
  }
}
