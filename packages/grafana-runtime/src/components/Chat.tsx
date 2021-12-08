import React, { FunctionComponent, PureComponent } from 'react';
import { getBackendSrv } from '../services/backendSrv';
import { Input } from '@grafana/ui';
import { getGrafanaLiveSrv } from '../services/live';
import { isLiveChannelMessageEvent, LiveChannelScope } from '@grafana/data';
import { Unsubscribable } from 'rxjs';

export interface ChatProps {
  contentTypeId: number;
  objectId: string;
}

export interface User {
  id: number;
  name: string;
  login: string;
  email: string;
  avatarUrl: string;
}

export interface Message {
  id: number;
  content: string;
  created: number;
  userId: number;
  user: User;
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
  chatBottom?: any;
  chatInput?: any;

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
    this.scrollToBottom('auto');
    this.chatInput.focus();
  }

  handleChange = (e: any) => {
    this.setState({ value: e.target.value });
  };

  sendMessage = async () => {
    if (!this.state.value) {
      return;
    }
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

  onKeyboardAdd = async (event: any) => {
    event.preventDefault();
    if (event.key === 'Enter') {
      await this.sendMessage();
    }
  };

  scrollToBottom = (behavior: string) => {
    if (!this.chatBottom) {
      return;
    }
    this.chatBottom.scrollIntoView({ behavior: behavior });
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
              this.scrollToBottom('auto');
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
      <div>
        <div style={{ overflow: 'scroll', marginBottom: '10px' }}>
          {this.state.messages.map((msg) => (
            <MessageElement key={msg.id} message={msg} />
          ))}
        </div>
        <Input
          type="text"
          placeholder="Write a message"
          value={this.state.value}
          onChange={this.handleChange}
          onKeyUp={this.onKeyboardAdd}
          ref={(el) => {
            this.chatInput = el;
          }}
        />
        <div
          style={{ float: 'left', clear: 'both' }}
          ref={(el) => {
            this.chatBottom = el;
          }}
        />
      </div>
    );
  }
}

interface MessageElementProps {
  message: Message;
}

const MessageElement: FunctionComponent<MessageElementProps> = ({ message }) => {
  let userColor = '#19a2e7';
  if (message.userId === 0) {
    userColor = '#34BA18';
  }
  const timeColor = '#898989';
  const timeFormatted = new Date(message.created * 1000).toLocaleTimeString();
  return (
    <div style={{ paddingTop: '2px', paddingBottom: '2px', wordBreak: 'break-word' }}>
      <div>
        <span style={{ color: userColor }}>{message.user ? message.user.login : 'System'}</span>
        &nbsp;
        <span style={{ color: timeColor }}>{timeFormatted}</span>
      </div>
      <div>{message.content}</div>
    </div>
  );
};
