import { NotifierType } from 'app/types';

export interface ChannelValues {
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
