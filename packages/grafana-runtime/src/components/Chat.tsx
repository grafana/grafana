import React, { PureComponent } from 'react';
import { getBackendSrv } from '../services/backendSrv';
import { getGrafanaLiveSrv } from '../services/live';
import { Button } from '../../../grafana-ui';
import { isLiveChannelMessageEvent, LiveChannelScope } from '../../../grafana-data';
import { Unsubscribable } from 'rxjs';

export interface ChatProps {
  contentTypeId: number;
  objectId: string;
}

export interface Message {
  id: number;
  content: string;
  created: number;
  userId: number;
}

export interface MessagePacket {
  event: string;
  messageCreated: Message;
}

export interface ChatState {
  messages: Message[];
  value: string;
}

export class Chat extends PureComponent<ChatProps, ChatState> {
  // dataSourceSrv = getDataSourceSrv();

  // static defaultProps: Partial<DataSourcePickerProps> = {
  //   autoFocus: false,
  //   openMenuOnFocus: false,
  //   placeholder: 'Select data source',
  // };
  subscription?: Unsubscribable;

  state: ChatState = {
    messages: [],
    value: '',
  };

  constructor(props: ChatProps) {
    super(props);
  }

  async componentDidMount() {
    const resp = await getBackendSrv().post('/api/chats/get-messages/', {
      objectId: this.props.objectId,
      contentTypeId: this.props.contentTypeId,
    });
    console.log(resp);
    this.setState({
      messages: resp.chatMessages,
    });
    this.updateSubscription();
  }

  handleChange = (e: { target: { value: any } }) => {
    this.setState({ value: e.target.value });
  };

  sendMessage = async () => {
    await getBackendSrv().post('/api/chats/send-message/', {
      objectId: this.props.objectId,
      contentTypeId: this.props.contentTypeId,
      content: this.state.value,
    });
    this.setState({
      value: '',
    });
  };

  getLiveAddr = () => {
    return {
      scope: LiveChannelScope.Grafana,
      namespace: 'chat', // holds on to the last value
      path: `${this.props.contentTypeId}/${this.props.objectId}`,
    };
  };

  getLiveChannel = () => {
    const live = getGrafanaLiveSrv();
    if (!live) {
      console.error('Grafana live not running, enable "live" feature toggle');
      return undefined;
    }

    const addr = this.getLiveAddr();
    if (!addr) {
      return undefined;
    }
    return live.getStream<MessagePacket>(addr);
  };

  updateSubscription = () => {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }

    const c = this.getLiveChannel();
    if (c) {
      console.log('SUBSCRIBE', c);
      this.subscription = c.subscribe({
        next: (msg) => {
          console.log('Got msg', msg);
          if (isLiveChannelMessageEvent(msg)) {
            const { messageCreated } = msg.message;
            if (messageCreated) {
              this.setState((prevState) => ({
                messages: [...prevState.messages, messageCreated],
              }));
            }
          }
          // } else if (isLiveChannelStatusEvent(msg)) {
          //   const update: Partial<State> = {
          //     status: msg,
          //   };
          //   if (msg.message) {
          //     update.boardData = msg.message;
          //   }
          //   this.setState(update);
          // }
        },
      });
    }
  };

  render() {
    return (
      <div id="hello">
        <div>
          {this.state.messages.map((msg) => (
            <span key={msg.id}>{msg.content}</span>
          ))}
        </div>
        <div>
          <input type="text" value={this.state.value} onChange={this.handleChange} />
        </div>
        <Button onClick={this.sendMessage}>Send</Button>
      </div>
    );
  }
}
