import React, { PureComponent } from 'react';
import { TextArea } from '@grafana/ui';
import { getGrafanaLiveSrv, getBackendSrv } from '@grafana/runtime';
import { isLiveChannelMessageEvent, LiveChannelScope } from '@grafana/data';
import { Unsubscribable } from 'rxjs';
import { ChatMessageAction } from './ChatMessageAction';
import { Message, ChatMessage } from './ChatMessage';

interface MessagePacket {
  event: string;
  messageCreated: Message;
}

export interface ChatProps {
  contentTypeId: number;
  objectId: string;
  actions?: ChatMessageAction[];
}

export interface ChatState {
  messages: Message[];
  value: string;
}

export class Chat extends PureComponent<ChatProps, ChatState> {
  subscription?: Unsubscribable;
  chatInput?: any;
  chatContainer?: any;

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
    if (!this.chatContainer) {
      return;
    }
    this.chatContainer.parentNode.scrollTop = this.chatContainer.scrollHeight;
  };

  updateSubscription = () => {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }

    const c = this.getLiveChannel();
    if (c) {
      this.subscription = c.subscribe({
        next: (msg) => {
          if (isLiveChannelMessageEvent(msg)) {
            const { messageCreated } = msg.message;
            if (messageCreated) {
              this.setState((prevState) => ({
                messages: [...prevState.messages, messageCreated],
              }));
              this.scrollToBottom();
            }
          }
        },
      });
    }
  };

  render() {
    let messageElements;
    if (this.state.messages.length > 0) {
      messageElements = (
        <div className="chat-messages">
          {this.state.messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} actions={this.props.actions} />
          ))}
        </div>
      );
    } else {
      messageElements = <div className="chat-messages">No messages here yet</div>;
    }

    return (
      <div
        className="chat"
        ref={(el) => {
          this.chatContainer = el;
        }}
      >
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
      </div>
    );
  }
}
