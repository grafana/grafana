import React, { PureComponent, ChangeEvent } from 'react';
import { FormField, Button } from '@grafana/ui';
import { SocketMessage } from '@grafana/runtime';
interface Props {}

interface State {
  connect: string;
  history: SocketMessage[];
}

export class SocketStatusWatcher extends PureComponent<Props, State> {
  state = {
    connect: '',
    history: [] as SocketMessage[],
  };

  onConnectStreamChanged = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ connect: event.target.value });
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

    const x = getWebSocketSrv().subscribe({
      stream: connect,
    });
    console.log('x', x);

    this.setState({ connect: '', history: [msg, ...history] });
  };

  render() {
    const { connect, history } = this.state;

    return (
      <div>
        <div className="gf-form-inline">
          <FormField label="Stream" value={connect || ''} onChange={this.onConnectStreamChanged} />
          <Button onClick={this.onSubscribeClick} variant="primary">
            Subscribe
          </Button>
        </div>

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
    <tr key={msg.time}>
      <td>{msg.time}</td>
      <td>{msg.stream}</td>
      <td>{JSON.stringify(msg.body)}</td>
    </tr>
  );
}
