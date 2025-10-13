import { SelectableValue, dataFrameFromJSON } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

interface ChannelInfo {
  channel: string;
  minute_rate: number; //
  data: unknown; // the last payload
}

interface ManagedChannels {
  channels: ChannelInfo[];
}

interface ChannelSelectionInfo {
  channels: Array<SelectableValue<string>>;
  channelFields: Record<string, Array<SelectableValue<string>>>;
}

export async function getManagedChannelInfo(): Promise<ChannelSelectionInfo> {
  return getBackendSrv()
    .get<ManagedChannels>('api/live/list')
    .then((v) => {
      const channelInfo = v.channels ?? [];
      const channelFields: Record<string, Array<SelectableValue<string>>> = {};
      const channels: Array<SelectableValue<string>> = channelInfo.map((c) => {
        if (c.data) {
          const distinctFields = new Set<string>();
          const frame = dataFrameFromJSON(c.data);
          for (const f of frame.fields) {
            distinctFields.add(f.name);
          }
          channelFields[c.channel] = Array.from(distinctFields).map((n) => ({
            value: n,
            label: n,
          }));
        }
        return {
          value: c.channel,
          label: c.channel + ' [' + c.minute_rate + ' msg/min]',
        };
      });
      return { channelFields, channels };
    });
}
