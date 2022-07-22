import { LiveChannelAddress } from '@grafana/data';

export enum MessageDisplayMode {
  Raw = 'raw', // Raw JSON string
  JSON = 'json', // formatted JSON
  Auto = 'auto', // pick a good display
  None = 'none', // do not display
}

export interface LivePanelOptions {
  channel?: LiveChannelAddress;
  message?: MessageDisplayMode;
  publish?: boolean;
  json?: any; // object
}
