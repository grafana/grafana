// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Types
import { StreamOptions } from './types';
import { PanelProps } from '@grafana/data';
import { config } from 'app/core/config';
import { Observer, Unsubscribable } from 'rxjs';
import { getWebStreamSrv } from '@grafana/runtime';
import { FormField, Button } from '@grafana/ui';

let counter = 0;

interface RecievedMessage {
  key: number;
  time: number;
  type: string;
  body: any;
}

interface Props extends PanelProps<StreamOptions> {}
interface State {
  history: RecievedMessage[];
  subscription?: Unsubscribable;
  action: string;
  body: string;
}

export class StreamPanel extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      history: [],
      action: 'send',
      body: JSON.stringify({ text: 'Hello' }),
    };
  }

  componentDidMount() {
    this.doSubscriptoin();
  }

  componentDidUpdate(oldProps: Props) {
    if (this.props.options !== oldProps.options) {
      const { options } = this.props;
      const oldOptions = oldProps.options;
      if (options.path !== oldOptions.path) {
        this.doSubscriptoin();
        return;
      }
      if (options.subscribe !== oldOptions.subscribe) {
        this.doSubscriptoin();
        return;
      }
    }
  }

  doSubscriptoin() {
    const { options } = this.props;
    if (this.state.subscription) {
      this.state.subscription.unsubscribe();
      this.setState({ subscription: undefined });
    }
    if (options.subscribe && options.path) {
      const subscription = getWebStreamSrv()
        .stream(options.path)
        .subscribe(this.observer);
      this.setState({ subscription });
    }
  }

  // Single observer for the panel
  observer: Observer<any> = {
    next: (value: any) => {
      console.log('PANEL Got', value);
      const msg = {
        key: counter++,
        type: 'next',
        time: Date.now(),
        body: value,
      };
      this.setState({ history: [msg, ...this.state.history] });
    },

    error: (err: any) => {
      console.log('ERROR', err);
      const msg = {
        key: counter++,
        type: 'error',
        time: Date.now(),
        body: err,
      };
      this.setState({ history: [msg, ...this.state.history] });
    },

    complete: () => {
      console.log('DONE');
      const msg = {
        key: counter++,
        type: 'complete',
        time: Date.now(),
        body: {},
      };
      this.setState({ history: [msg, ...this.state.history], subscription: undefined });
    },
  };

  onActionChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ action: event.target.value });
  };

  onBodyChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ body: event.target.value });
  };

  onSendClick = async () => {
    const { options } = this.props;
    const { action } = this.state;
    let { body } = this.state;
    try {
      body = JSON.parse(body);
    } catch {}

    const v = await getWebStreamSrv()
      .write(options.path, action, body)
      .toPromise();
    console.log('WRITE response', v);

    // Add the response to history
    const msg: RecievedMessage = {
      key: counter++,
      type: 'write-response',
      time: Date.now(),
      body: v,
    };
    this.setState({ history: [msg, ...this.state.history] });
  };

  render() {
    if (!config.featureToggles.streams) {
      return (
        <div>
          Streams are not enabled...
          <br />
          <br />
          add the feature toggle <code>streams</code>
        </div>
      );
    }
    const { subscription, history, action, body } = this.state;

    return (
      <div>
        {subscription ? (
          <div>
            SUBSCRIBED.... add buttons
            <FormField label="Action" value={action || ''} onChange={this.onActionChanged} />
            <FormField label="Body" value={body || ''} onChange={this.onBodyChanged} />
            <Button onClick={this.onSendClick} variant="primary">
              Send
            </Button>
          </div>
        ) : (
          <div>[NOT Connected...]</div>
        )}
        {history.length > 0 && (
          <table className="filter-table form-inline">
            <thead>
              <tr>
                <th>Time</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>{history.map(StreamEventRow)}</tbody>
          </table>
        )}
      </div>
    );
  }
}

function StreamEventRow(msg: RecievedMessage) {
  return (
    <tr key={msg.key}>
      <td>{msg.time}</td>
      <td>{JSON.stringify(msg.body)}</td>
    </tr>
  );
}
