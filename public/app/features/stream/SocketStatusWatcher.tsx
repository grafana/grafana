import React, { PureComponent, ChangeEvent } from 'react';
import { FormField, Button } from '@grafana/ui';
import { getWebStreamSrv, SocketMessage } from '@grafana/runtime';
interface Props {}

interface State {
  connect: string;
  history: SocketMessage[];
  stream: string;
  body: string;
}

export class SocketStatusWatcher extends PureComponent<Props, State> {
  state = {
    connect: '',
    history: [] as SocketMessage[],
    stream: '',
    body: '{ "hello":"world" }',
  };

  onConnectStreamChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ connect: event.target.value });
  };

  onSendStreamChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ stream: event.target.value });
  };

  onBodyChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ body: event.target.value });
  };

  onSubscribeClick = () => {
    const { connect, history } = this.state;
    const msg: SocketMessage = {
      stream: connect,
      time: Date.now(),
      body: {
        message: 'TODO!!! actually connect...',
      },
    };

    const x = getWebStreamSrv().subscribe({
      stream: connect,
    });
    console.log('x', x);

    this.setState({ connect: '', history: [msg, ...history] });
  };

  onSendClick = () => {
    const { stream } = this.state;
    let { body } = this.state;
    try {
      body = JSON.parse(body);
    } catch {}

    const msg: SocketMessage = {
      stream,
      time: Date.now(),
      body,
    };

    const x = getWebStreamSrv().write(msg);
    console.log('yyyy', x);
    this.setState({ history: [msg, ...history] });
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
          <tbody>{history.map(SocketMessageRow)}</tbody>
        </table>
      </div>
    );
  }
}

function SocketMessageRow(msg: SocketMessage) {
  return (
    <tr key={msg.time + msg.stream}>
      <td>{msg.time}</td>
      <td>{msg.stream}</td>
      <td>{JSON.stringify(msg.body)}</td>
    </tr>
  );
}
