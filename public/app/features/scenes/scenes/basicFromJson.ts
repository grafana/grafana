import { sceneFromJSON } from '../core/serialization';

const model = {
  key: 'cd6a15d7-b079-4e5c-a391-4962841d9b47',
  title: 'Minimal example: Data + viz',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: '7dbf266f-c263-477b-bbcb-7dc16d07744a',
      inputParams: {},
      type: 'SceneTimeRange',
    },
    {
      queries: [
        {
          refId: 'A',
          datasource: {
            uid: 'gdev-testdata',
            type: 'testdata',
          },
          scenarioId: 'random_walk',
        },
      ],
      key: 'fda86f55-d29f-432f-891d-ff7fd9d0df72',
      inputParams: {
        timeRange: '7dbf266f-c263-477b-bbcb-7dc16d07744a',
      },
      type: 'SceneDataProviderNode',
    },
  ],
  layout: {
    root: [
      {
        $ref: '7dbf266f-c263-477b-bbcb-7dc16d07744a',
      },
      {
        inputParams: {
          data: 'fda86f55-d29f-432f-891d-ff7fd9d0df72',
        },
        pluginId: 'timeseries',
        title: 'Title',
        options: {
          legend: {
            displayMode: 'hidden',
          },
        },
        key: '7d1e42e0-832e-41b3-963d-2e03d5713327',
        type: 'VizPanel',
      },
    ],
  },
};

export const demoFromJSON = {
  title: 'Minimal example: Data + viz (from JSON)',
  getScene: () => sceneFromJSON(model),
};
