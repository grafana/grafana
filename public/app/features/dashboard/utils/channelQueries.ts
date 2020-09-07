import { DataSourceApi, DataQueryChannel, DataQuery } from '@grafana/data';

export interface ChannelQueries {
  standard: DataQuery[];
  channels?: Map<DataQueryChannel, DataQuery[]>;
}

export function getChannelQueries(ds: DataSourceApi, targets: DataQuery[]): ChannelQueries {
  const info: ChannelQueries = {
    standard: [],
  };
  const addQuery = (q: DataQuery) => {
    if (!q.datasource) {
      q.datasource = ds.name;
    }
    if (!q.queryChannel || q.queryChannel === DataQueryChannel.Standard) {
      info.standard.push(q);
    } else {
      if (!info.channels) {
        info.channels = new Map<DataQueryChannel, DataQuery[]>();
      }
      let channel = info.channels!.get(q.queryChannel);
      if (!channel) {
        channel = [] as DataQuery[];
        info.channels.set(q.queryChannel, channel);
      }
      channel.push(q);
    }
  };

  for (const query of targets) {
    addQuery(query);

    if (ds.getAdditionalChannelQueries) {
      const subs = ds.getAdditionalChannelQueries(query);
      if (subs) {
        for (const sub of subs) {
          addQuery(sub);
        }
      }
    }
  }
  return info;
}
