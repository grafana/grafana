import { DataSourceApi, DataQueryTopic, DataQuery } from '@grafana/data';

export interface ChannelQueries {
  standard: DataQuery[];
  channels?: Map<DataQueryTopic, DataQuery[]>;
}

export function getChannelQueries(ds: DataSourceApi, targets: DataQuery[]): ChannelQueries {
  const info: ChannelQueries = {
    standard: [],
  };
  const addQuery = (q: DataQuery) => {
    if (!q.datasource) {
      q.datasource = ds.name;
    }
    if (!q.queryTopic || q.queryTopic === DataQueryTopic.Standard) {
      info.standard.push(q);
    } else {
      if (!info.channels) {
        info.channels = new Map<DataQueryTopic, DataQuery[]>();
      }
      let channel = info.channels!.get(q.queryTopic);
      if (!channel) {
        channel = [] as DataQuery[];
        info.channels.set(q.queryTopic, channel);
      }
      channel.push(q);
    }
  };

  for (const query of targets) {
    addQuery(query);

    if (ds.getAdditionalDataQueryTopics) {
      const subs = ds.getAdditionalDataQueryTopics(query);
      if (subs) {
        for (const sub of subs) {
          addQuery(sub);
        }
      }
    }
  }
  return info;
}
