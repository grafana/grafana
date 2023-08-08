import React from 'react';

import { PanelPlugin, PanelProps } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

type MessagePanelOptions = {
  message?: string;
  color?: string;
  backgroundColor?: string;
  backgroundImage?: string; // https://images.unsplash.com/photo-1451188502541-13943edb6acb
};

const MessagePanel = (props: PanelProps<MessagePanelOptions>) => {
  const { options, width, height } = props;
  const theme = useTheme2();
  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: options.backgroundColor || theme.colors.background.canvas,
        backgroundImage: `url(${options.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        color: options.color || theme.colors.text.primary,
        width: `${width}px`,
        height: `${height}px`,
        textAlign: 'center',
        paddingBlock: '40px',
      }}
    >
      <h1 style={{ background: 'rgba(0,0,0,0.2)', paddingBlock: '20px' }}>{options.message || 'Hello'}</h1>
    </div>
  );
};
export const plugin = new PanelPlugin<MessagePanelOptions>(MessagePanel);
