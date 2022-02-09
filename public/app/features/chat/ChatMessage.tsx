import React, { FunctionComponent, useState } from 'react';
import { IconButton, MenuGroup, MenuItem, WithContextMenu } from '@grafana/ui';
import { sanitize } from '@grafana/data/src/text/sanitize';
import { marked } from 'marked';
import { ChatMessageAction } from './ChatMessageAction';
import { User } from './ChatUser';

export interface Message {
  id: number;
  content: string;
  created: number;
  userId: number;
  user: User;
}

function renderChatMarkdown(str?: string): string {
  const html = marked(str || '', {
    pedantic: false,
    gfm: true,
    smartLists: true,
    smartypants: false,
    xhtml: false,
    breaks: true,
  });
  return sanitize(html);
}

interface ChatMessageProps {
  message: Message;
  actions?: ChatMessageAction[];
}

export const ChatMessage: FunctionComponent<ChatMessageProps> = ({ message, actions = [] }) => {
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

  const onMouseEnter = () => {
    setShowActionIcon(true);
  };

  const onMouseLeave = () => {
    setShowActionIcon(false);
  };

  const renderMenuGroupItems = () => {
    return (
      <MenuGroup label="">
        {actions.map((action) => (
          <MenuItem
            key={action.verbal}
            label={action.verbal}
            onClick={() => {
              action.action(message);
            }}
          />
        ))}
      </MenuGroup>
    );
  };

  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} className="chat-message">
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
        {actions.length > 0 && showActionIcon && (
          <WithContextMenu renderMenuItems={renderMenuGroupItems} focusOnOpen={false}>
            {({ openMenu }) => <IconButton name="info-circle" onClick={openMenu} />}
          </WithContextMenu>
        )}
      </div>
      <div style={{ clear: 'both' }}></div>
    </div>
  );
};
