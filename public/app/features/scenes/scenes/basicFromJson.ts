import { sceneFromJSON } from '../core/serialization';

const model = {
  key: '0db9f739-8097-48b6-ae4a-562c7745d0fb',
  title: 'Minimal example: Data + viz',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: '4e1dcb80-0355-4408-87b2-209da20e74c8',
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
      key: '7e35fb68-5d6f-4be7-a3f3-5ff0ad363b45',
      inputParams: {
        timeRange: {
          $ref: '4e1dcb80-0355-4408-87b2-209da20e74c8',
        },
      },
      type: 'SceneDataProviderNode',
    },
  ],
  layout: {
    root: [
      {
        inputParams: {
          timeRange: {
            $ref: '4e1dcb80-0355-4408-87b2-209da20e74c8',
          },
        },
        key: 'd666b805-88d5-42c7-b913-e4db734352b0',
        type: 'SceneTimePicker',
      },
      {
        inputParams: {
          data: {
            $ref: '7e35fb68-5d6f-4be7-a3f3-5ff0ad363b45',
          },
        },
        pluginId: 'timeseries',
        title: 'Title',
        options: {
          legend: {
            displayMode: 'hidden',
          },
        },
        key: '050de300-e16b-4b53-8c16-a7ad38bdef7d',
        type: 'VizPanel',
      },
    ],
  },
};

export const demoFromJSON = {
  title: 'Minimal example: Data + viz (from JSON)',
  getScene: () => sceneFromJSON(model),
};
