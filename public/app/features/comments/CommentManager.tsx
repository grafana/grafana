import React, { PureComponent } from 'react';
import { isLiveChannelMessageEvent, LiveChannelScope } from '@grafana/data';
import { getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';
import { Unsubscribable } from 'rxjs';

import { CommentView } from './CommentView';
import { Message, MessagePacket } from './types';

export interface Props {
  contentTypeId: number;
  objectId: string;
}

export interface State {
  messages: Message[];
  value: string;
}

export class CommentManager extends PureComponent<Props, State> {
  subscription?: Unsubscribable;
  packetCounter = 0;

  constructor(props: Props) {
    super(props);

    this.state = {
      messages: [],
      value: '',
    };
  }

  async componentDidMount() {
    const resp = await getBackendSrv().post('/api/chats/get-messages/', {
      objectId: this.props.objectId,
      contentTypeId: this.props.contentTypeId,
    });
    this.packetCounter++;
    this.setState({
      messages: resp.chatMessages,
    });
    this.updateSubscription();
  }

  getLiveChannel = () => {
    const live = getGrafanaLiveSrv();
    if (!live) {
      console.error('Grafana live not running, enable "live" feature toggle');
      return undefined;
    }

    const address = this.getLiveAddress();
    if (!address) {
      return undefined;
    }

    return live.getStream<MessagePacket>(address);
  };

  getLiveAddress = () => {
    return {
      scope: LiveChannelScope.Grafana,
      namespace: 'chat', // holds on to the last value
      path: `${this.props.contentTypeId}/${this.props.objectId}`,
    };
  };

  updateSubscription = () => {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }

    const channel = this.getLiveChannel();
    if (channel) {
      this.subscription = channel.subscribe({
        next: (msg) => {
          if (isLiveChannelMessageEvent(msg)) {
            const { messageCreated } = msg.message;
            if (messageCreated) {
              this.setState((prevState) => ({
                messages: [...prevState.messages, messageCreated],
              }));
              this.packetCounter++;
            }
          }
        },
      });
    }
  };

  addComment = async (comment: string): Promise<boolean> => {
    const response = await getBackendSrv().post('/api/chats/send-message/', {
      objectId: this.props.objectId,
      contentTypeId: this.props.contentTypeId,
      content: comment,
    });

    // TODO: set up error handling
    console.log(response);

    return true;
  };

  render() {
    return (
      <CommentView comments={this.state.messages} packetCounter={this.packetCounter} addComment={this.addComment} />
    );
  }
}
