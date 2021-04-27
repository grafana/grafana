import { NotifierType } from 'app/types';
import React from 'react';

export interface ChannelValues {
  __id: string; // used to correllate form values to original DTOs
  type: string;
  settings: Record<string, any>;
  secureSettings: Record<string, any>;
  secureFields: Record<string, boolean>;
}

export interface ReceiverFormValues<R extends ChannelValues> {
  name: string;
  items: R[];
}

export interface CloudChannelValues extends ChannelValues {
  type: string;
  sendResolved: boolean;
}

export interface GrafanaChannelValues extends ChannelValues {
  type: NotifierType;
  uid?: string;
  sendReminder: boolean;
  disableResolveMessage: boolean;
}

export interface CommonSettingsComponentProps {
  pathPrefix: string;
  className?: string;
}
export type CommonSettingsComponentType = React.ComponentType<CommonSettingsComponentProps>;

export type CloudChannelConfig = {
  send_resolved: boolean;
  [key: string]: unknown;
};
