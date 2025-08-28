import * as React from 'react';

import { GrafanaManagedReceiverConfig } from 'app/plugins/datasource/alertmanager/types';
import { CloudNotifierType, NotifierType } from 'app/features/alerting/unified/types/alerting';

import { ControlledField } from '../hooks/useControlledFieldArray';

export interface ChannelValues {
  __id: string; // used to correlate form values to original DTOs
  type: string;
  settings: Record<string, any>;
  secureFields: Record<string, boolean | ''>;
}

export interface ReceiverFormValues<R extends ChannelValues> {
  name: string;
  items: Array<ControlledField<R>>;
}

export interface CloudChannelValues extends ChannelValues {
  type: string;
  sendResolved: boolean;
}

export interface GrafanaChannelValues extends ChannelValues {
  type: NotifierType;
  provenance?: string;
  disableResolveMessage?: boolean;
}

export interface CommonSettingsComponentProps {
  pathPrefix: string;
  className?: string;
  readOnly?: boolean;
}
export type CommonSettingsComponentType = React.ComponentType<CommonSettingsComponentProps>;

export type CloudChannelConfig = {
  send_resolved: boolean;
  [key: string]: unknown;
};

// id to notifier
export type GrafanaChannelMap = Record<string, GrafanaManagedReceiverConfig>;
export type CloudChannelMap = Record<
  string,
  {
    type: CloudNotifierType;
    config: CloudChannelConfig;
  }
>;
