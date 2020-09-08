import { DataSourceApi, DataQueryTopic, DataQuery } from '@grafana/data';

export interface TopicQueries {
  standard: DataQuery[];
  topics?: Map<DataQueryTopic, DataQuery[]>;
}

export function getTopicQueries(ds: DataSourceApi, targets: DataQuery[]): TopicQueries {
  const info: TopicQueries = {
    standard: [],
  };
  const addQuery = (q: DataQuery) => {
    if (!q.datasource) {
      q.datasource = ds.name;
    }
    if (!q.queryTopic || q.queryTopic === DataQueryTopic.Standard) {
      info.standard.push(q);
    } else {
      if (!info.topics) {
        info.topics = new Map<DataQueryTopic, DataQuery[]>();
      }
      let topics = info.topics!.get(q.queryTopic);
      if (!topics) {
        topics = [] as DataQuery[];
        info.topics.set(q.queryTopic, topics);
      }
      topics.push(q);
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
