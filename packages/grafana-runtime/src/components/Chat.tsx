import React, { PureComponent } from 'react';
import { getBackendSrv } from '../services/backendSrv';
import { Button } from '../../../grafana-ui';

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
      messages: resp.messages,
    });
  }

  handleChange = (e: { target: { value: any } }) => {
    this.setState({ value: e.target.value });
  };

  sendMessage = async () => {
    console.log('send');
    const resp = await getBackendSrv().post('/api/chats/send-message/', {
      objectId: this.props.objectId,
      contentTypeId: this.props.contentTypeId,
      content: this.state.value,
    });
    console.log(resp);
    const newMessage = resp.message;
    console.log(newMessage);
    console.log(this.state.messages);
    this.setState((prevState) => ({
      messages: [...prevState.messages, newMessage],
      value: '',
    }));
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
