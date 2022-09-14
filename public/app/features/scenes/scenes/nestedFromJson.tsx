import { sceneFromJSON } from '../core/serialization';

const model = {
  key: '329d05c3-a0c4-4817-8e47-3e953b830f57',
  title: 'Nested Scene demo',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: 'b4bc6395-38ac-49ef-a533-12bca6cb4bcc',
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
      key: 'f821561a-033c-4bf8-a502-911ad7338a62',
      inputParams: {
        timeRange: { $ref: 'b4bc6395-38ac-49ef-a533-12bca6cb4bcc' },
      },
      type: 'SceneDataProviderNode',
    },
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: 'dfae5b0b-a34a-4d95-a814-2014b91c2e29',
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
          scenarioId: 'random_walk_table',
        },
      ],
      key: '3defa351-4455-4a09-8425-c33ad73ab3e1',
      inputParams: {
        timeRange: { $ref: 'dfae5b0b-a34a-4d95-a814-2014b91c2e29' },
      },
      type: 'SceneDataProviderNode',
    },
  ],
  layout: {
    root: [
      {
        direction: 'column',
        key: 'b1aa5b95-5b1e-4ad9-b88e-58ceb94cdeb5',
        inputParams: {},
        type: 'SceneFlexLayout',
        children: [
          {
            size: {
              ySizing: 'content',
            },
            key: '037fe7d8-e332-471f-8ab0-f4a398311c93',
            direction: 'column',
            inputParams: {},
            type: 'SceneFlexChild',
            children: [
              {
                $ref: 'b4bc6395-38ac-49ef-a533-12bca6cb4bcc',
              },
            ],
          },
          {
            key: '59647faf-980f-4fa6-950f-55ec806d5627',
            direction: 'column',
            inputParams: {},
            type: 'SceneFlexChild',
            children: [
              {
                direction: 'column',
                key: 'a9bab188-05de-4da5-a261-85fbe2d4ed03',
                inputParams: {},
                type: 'SceneFlexLayout',
                children: [
                  {
                    key: 'dab3a081-ec43-4120-99e5-6811c061bbd6',
                    direction: 'column',
                    inputParams: {},
                    type: 'SceneFlexChild',
                    children: [
                      {
                        inputParams: {
                          data: { $ref: 'f821561a-033c-4bf8-a502-911ad7338a62' },
                        },
                        key: '3',
                        pluginId: 'timeseries',
                        title: 'Panel 3',
                        type: 'VizPanel',
                      },
                    ],
                  },
                  {
                    $ref: '840dc3c3-585a-4422-8e00-d81de0d3426f',
                    type: 'NestedScene',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    '840dc3c3-585a-4422-8e00-d81de0d3426f': {
      key: '840dc3c3-585a-4422-8e00-d81de0d3426f',
      title: 'Inner scene',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          $ref: '3defa351-4455-4a09-8425-c33ad73ab3e1',
        },
        {
          $ref: 'dfae5b0b-a34a-4d95-a814-2014b91c2e29',
        },
      ],
      layout: {
        root: [
          {
            direction: 'row',
            key: '907b49d8-ec8b-4bdb-b6a0-81095de914c3',
            inputParams: {},
            type: 'SceneFlexLayout',
            children: [
              {
                key: 'ce96f9cd-4877-46c1-bff1-ae324bbaf998',
                direction: 'row',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: { $ref: '3defa351-4455-4a09-8425-c33ad73ab3e1' },
                    },
                    key: '3',
                    pluginId: 'timeseries',
                    title: 'Data',
                    type: 'VizPanel',
                  },
                ],
              },
              {
                key: 'eab2ac74-f8d9-42e8-961f-1cb841f6489b',
                direction: 'row',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: { $ref: '3defa351-4455-4a09-8425-c33ad73ab3e1' },
                    },
                    key: '3',
                    pluginId: 'timeseries',
                    title: 'Data',
                    type: 'VizPanel',
                  },
                ],
              },
            ],
          },
        ],
      },
      actions: [
        {
          $ref: 'dfae5b0b-a34a-4d95-a814-2014b91c2e29',
        },
      ],
      isCollapsed: false,
      canCollapse: true,
      canRemove: true,
    },
  },
};

export const nestedSceneFromJson = {
  title: 'Scene with a nested scene (from JSON)',
  getScene: () => sceneFromJSON(model),
};
