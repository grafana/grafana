import React, { PureComponent, ChangeEvent } from 'react';
import { FormField, Button } from '@grafana/ui';
import { getWebStreamSrv, StreamEvent } from '@grafana/runtime';
interface Props {}

interface State {
  connect: string;
  history: StreamEvent[];
  stream: string;
  action: string;
  body: string;
}

export class SocketStatusWatcher extends PureComponent<Props, State> {
  state = {
    connect: '',
    history: [] as StreamEvent[],
    stream: '',
    action: 'something',
    body: '{ "hello":"world" }',
  };

  onConnectStreamChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ connect: event.target.value });
  };

  onSendStreamChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ stream: event.target.value });
  };

  onActionChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ action: event.target.value });
  };

  onBodyChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ body: event.target.value });
  };

  onSubscribeClick = () => {
    const { connect, history } = this.state;
    const msg: StreamEvent = {
      stream: connect,
      time: Date.now(),
      body: {
        message: 'TODO!!! actually connect...',
      },
    };

    const x = getWebStreamSrv().subscribe(connect);
    console.log('x', x);

    this.setState({ connect: '', history: [msg, ...history] });
  };

  onSendClick = async () => {
    const { stream, action } = this.state;
    let { body } = this.state;
    try {
      body = JSON.parse(body);
    } catch {}

    const v = await getWebStreamSrv()
      .write(stream, action, body)
      .toPromise();
    console.log('WRITE response', v);

    const msg: StreamEvent = {
      stream,
      time: Date.now(),
      body: v,
    };

    this.setState({ history: [msg, ...this.state.history] });
  };

  render() {
    const { connect, history, stream, body } = this.state;

    return (
      <div>
        <table>
          <tbody>
            <tr valign="top">
              <td>
                <h3>Connect</h3>
                <FormField label="Stream" value={connect || ''} onChange={this.onConnectStreamChanged} />
                <Button onClick={this.onSubscribeClick} variant="primary">
                  Subscribe
                </Button>
              </td>
              <td>&nbsp;</td>
              <td>
                <h3>Send</h3>
                <FormField label="Stream" value={stream || ''} onChange={this.onSendStreamChanged} />
                <FormField label="Body" value={body || ''} onChange={this.onBodyChanged} />
                <Button onClick={this.onSendClick} variant="primary">
                  Send
                </Button>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="filter-table form-inline">
          <thead>
            <tr>
              <th>Time</th>
              <th>Stream</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>{history.map(StreamEventRow)}</tbody>
        </table>
      </div>
    );
  }
}

function StreamEventRow(msg: StreamEvent) {
  return (
    <tr key={msg.time + msg.stream}>
      <td>{msg.time}</td>
      <td>{msg.stream}</td>
      <td>{JSON.stringify(msg.body)}</td>
    </tr>
  );
}
