import { LiveChannelAddress } from '@grafana/data';

export enum MessageDisplayMode {
  Raw = 'raw', // Raw JSON string
  JSON = 'json', // formatted JSON
  Auto = 'auto', // pick a good display
  None = 'none', // do not display
}

export enum MessagePublishMode {
  None = 'none', // do not display
  JSON = 'json', // formatted JSON
  Influx = 'influx', // influx line protocol
}

export interface LivePanelOptions {
  channel?: LiveChannelAddress;
  display?: MessageDisplayMode;
  publish?: MessagePublishMode;
  message?: string | object; // likely JSON
}
