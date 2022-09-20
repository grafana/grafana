import { sceneFromJSON } from '../core/serialization';

const model = {
  key: '11cbd959-3bc9-4961-8824-0e8011984a90',
  title: 'Nested Scene demo',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: '67f39be6-d9a3-4b8f-805c-88d9e50eba1f',
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
      key: '4063aeba-f52c-4f2b-bcd2-040ac022d212',
      inputParams: {
        timeRange: {
          $ref: '67f39be6-d9a3-4b8f-805c-88d9e50eba1f',
        },
      },
      type: 'SceneDataProviderNode',
    },
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: '40f1311c-ebc4-459d-acf2-91661f2b56ca',
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
      key: 'c6ecee80-c771-4926-a69c-a2156296a828',
      inputParams: {
        timeRange: {
          $ref: '40f1311c-ebc4-459d-acf2-91661f2b56ca',
        },
      },
      type: 'SceneDataProviderNode',
    },
  ],
  layout: {
    root: [
      {
        direction: 'column',
        children: [
          {
            size: {
              ySizing: 'content',
            },
            children: [
              {
                inputParams: {
                  timeRange: {
                    $ref: '67f39be6-d9a3-4b8f-805c-88d9e50eba1f',
                  },
                },
                key: '38b5d061-cff7-4b18-9153-2a1aec9f12fe',
                type: 'SceneTimePicker',
              },
            ],
            key: '19c5551c-19d6-45df-a384-9a3639035f46',
            inputParams: {},
            type: 'SceneFlexChild',
          },
          {
            children: [
              {
                direction: 'column',
                children: [
                  {
                    children: [
                      {
                        inputParams: {
                          data: {
                            $ref: '4063aeba-f52c-4f2b-bcd2-040ac022d212',
                          },
                        },
                        key: '3',
                        pluginId: 'timeseries',
                        title: 'Panel 3',
                        type: 'VizPanel',
                      },
                    ],
                    key: 'f72a08f6-6e26-4999-8dfd-0d862cd8aa99',
                    inputParams: {},
                    type: 'SceneFlexChild',
                  },
                  {
                    $ref: '48021022-fff3-4347-83d0-c6f4dcb818c9',
                    type: 'NestedScene',
                  },
                ],
                key: '8bcb6297-f193-4f49-9105-6bbef2d50561',
                inputParams: {},
                type: 'SceneFlexLayout',
              },
            ],
            key: '3e626395-779f-43cd-afa3-0adaf7a24b69',
            inputParams: {},
            type: 'SceneFlexChild',
          },
        ],
        key: 'bed87885-7ff6-4d7c-a209-8d9a16b68010',
        inputParams: {},
        type: 'SceneFlexLayout',
      },
    ],
    '48021022-fff3-4347-83d0-c6f4dcb818c9': {
      key: '48021022-fff3-4347-83d0-c6f4dcb818c9',
      title: 'Inner scene',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          $ref: 'c6ecee80-c771-4926-a69c-a2156296a828',
        },
        {
          $ref: '40f1311c-ebc4-459d-acf2-91661f2b56ca',
        },
      ],
      layout: {
        root: [
          {
            direction: 'row',
            children: [
              {
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: 'c6ecee80-c771-4926-a69c-a2156296a828',
                      },
                    },
                    key: '3',
                    pluginId: 'timeseries',
                    title: 'Data',
                    type: 'VizPanel',
                  },
                ],
                key: '03227c46-7cba-42bb-bf70-51c9dcb5eec0',
                inputParams: {},
                type: 'SceneFlexChild',
              },
              {
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: 'c6ecee80-c771-4926-a69c-a2156296a828',
                      },
                    },
                    key: '3',
                    pluginId: 'timeseries',
                    title: 'Data',
                    type: 'VizPanel',
                  },
                ],
                key: 'c1d2d1a3-4b1d-4e52-9876-06207d1953a1',
                inputParams: {},
                type: 'SceneFlexChild',
              },
            ],
            key: 'edfab794-dc8a-4726-9ff4-916ef7b08478',
            inputParams: {},
            type: 'SceneFlexLayout',
          },
        ],
      },
      actions: [
        {
          inputParams: {
            timeRange: {
              $ref: '40f1311c-ebc4-459d-acf2-91661f2b56ca',
            },
          },
          key: 'd8b9d76a-0250-4e13-a100-0056164b3975',
          type: 'SceneTimePicker',
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
