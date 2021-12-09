import React, { FunctionComponent, PureComponent, useState } from 'react';
import { getBackendSrv } from '../services/backendSrv';
import { TextArea, ValuePicker } from '@grafana/ui';
import { getGrafanaLiveSrv } from '../services/live';
import { isLiveChannelMessageEvent, LiveChannelScope, renderChatMarkdown } from '@grafana/data';
import { Unsubscribable } from 'rxjs';

export interface ChatProps {
  contentTypeId: number;
  objectId: string;
  actions?: ChatMessageAction[];
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
    this.scrollToBottom();
    this.focusInput();
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

  onKeyboardPress = async (e: any) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      let start = e.target.selectionStart,
        end = e.target.selectionEnd;
      this.setState(
        (prevState) => ({ value: prevState.value.substring(0, start) + '\n' + prevState.value.substring(end) }),
        () => {
          this.chatInput.selectionStart = this.chatInput.selectionEnd = start + 1;
        }
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  onKeyboardUp = async (e: any) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return;
      }
      e.preventDefault();
      await this.sendMessage();
    }
  };

  focusInput = () => {
    if (!this.chatInput) {
      return;
    }
    this.chatInput.focus();
  };

  scrollToBottom = () => {
    if (!this.chatBottom) {
      return;
    }
    this.chatBottom.scrollIntoView({ behavior: 'auto' });
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
              this.scrollToBottom();
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
    let messageElements;
    if (this.state.messages.length > 0) {
      messageElements = (
        <div style={{ overflow: 'scroll', marginBottom: '10px' }}>
          {this.state.messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} actions={this.props.actions} />
          ))}
        </div>
      );
    } else {
      messageElements = <div style={{ overflow: 'scroll', marginBottom: '10px' }}>No messages here yet</div>;
    }

    return (
      <div className="chat">
        {messageElements}
        <TextArea
          placeholder="Write a message"
          value={this.state.value}
          onChange={this.handleChange}
          onKeyUp={this.onKeyboardUp}
          onKeyPress={this.onKeyboardPress}
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

interface ChatMessageAction {
  verbal: string;
  action: any;
}

interface ChatMessageProps {
  message: Message;
  actions?: ChatMessageAction[];
}

// const messageContentCss = css`
//   p {
//     margin: 0;
//   }
// `

const ChatMessage: FunctionComponent<ChatMessageProps> = ({
  message,
  actions = [
    { verbal: 'hi', action: console.log },
    { verbal: 'hello', action: console.log },
  ],
}) => {
  let senderColor = '#34BA18';
  let senderName = 'System';
  let avatarUrl = '/public/img/grafana_icon.svg';
  if (message.userId > 0) {
    senderColor = '#19a2e7';
    senderName = message.user.login;
    avatarUrl = message.user.avatarUrl;
  }
  const timeColor = '#898989';
  const timeFormatted = new Date(message.created * 1000).toLocaleTimeString();
  const markdownContent = renderChatMarkdown(message.content);

  // const [actionMenuExpanded, setActionMenuExpanded] = useState(false);
  const [showActionIcon, setShowActionIcon] = useState(false);

  let actionOptions = [];
  for (const i in actions) {
    actionOptions.push({ label: actions[i].verbal, value: actions[i].action });
  }
  return (
    <div
      onMouseEnter={() => {
        setShowActionIcon(true);
      }}
      onMouseLeave={() => {
        setShowActionIcon(false);
      }}
      className="chat-message"
    >
      <div style={{ float: 'left', paddingTop: '6px', marginRight: '10px' }}>
        <img src={avatarUrl} alt="" style={{ width: '30px', height: '30px' }} />
      </div>
      <div style={{ position: 'relative' }}>
        <div>
          <span style={{ color: senderColor }}>{senderName}</span>
          &nbsp;
          <span style={{ color: timeColor }}>{timeFormatted}</span>
        </div>
        <div>
          <div className="chat-message-content" dangerouslySetInnerHTML={{ __html: markdownContent }} />
        </div>
        {showActionIcon && (
          <ValuePicker
            label=""
            icon="bars"
            options={actionOptions}
            onChange={(value: any) => {
              value.value(message);
              setShowActionIcon(false);
            }}
            variant="secondary"
            size="sm"
            isFullWidth={false}
          />
        )}
      </div>
      <div style={{ clear: 'both' }}></div>
    </div>
  );
};
