import { Chance } from 'chance';

import { DataSourceInstanceSettings, PluginType } from '@grafana/data';

export function wellFormedDatasource(
  seed = 1,
  custom: Partial<DataSourceInstanceSettings> = {}
): DataSourceInstanceSettings {
  const random = Chance(seed);

  return {
    id: random.integer(),
    uid: random.guid(),
    type: random.word(),
    name: random.sentence({ words: 3 }),
    readOnly: false,
    jsonData: {},
    meta: {
      id: random.word(),
      name: random.word(),
      type: PluginType.datasource,
      module: random.word(),
      baseUrl: random.url(),

      info: {
        author: {
          name: random.name(),
        },
        description: random.sentence({ words: 5 }),

        links: [],
        logos: {
          large: random.url(),
          small: random.url(),
        },
        screenshots: [],
        updated: random.date().toISOString(),
        version: '1.0.0',
      },
    },
    access: 'direct',
    ...custom,
  };
}
