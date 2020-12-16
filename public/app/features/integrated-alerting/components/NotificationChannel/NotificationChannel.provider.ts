import React from 'react';
import { NotificationChannelContext } from './NotificationChannel.types';

export const NotificationChannelProvider = React.createContext<NotificationChannelContext>(
  {} as NotificationChannelContext
);
