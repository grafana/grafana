import { sceneFromJSON } from '../core/serialization';

const model = {
  key: 'a8c16fc2-ea51-47e7-92e2-9d3b689e4637',
  title: 'Nested Scene demo (isolated)',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: '575ffdce-ed26-41cb-b7a3-972f8dbf7a09',
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
      key: '04430c0e-7782-47e9-9104-7509503a8f69',
      inputParams: {
        timeRange: {
          $ref: '575ffdce-ed26-41cb-b7a3-972f8dbf7a09',
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
            $ref: '7001d323-577d-4d0d-b019-cd9e526e0df4',
            type: 'NestedScene',
          },
        ],
        key: 'dfa617e1-c733-4830-847b-38020401b992',
        inputParams: {},
        type: 'SceneFlexLayout',
      },
    ],
    '7001d323-577d-4d0d-b019-cd9e526e0df4': {
      key: '7001d323-577d-4d0d-b019-cd9e526e0df4',
      title: 'Inner scene',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          $ref: '04430c0e-7782-47e9-9104-7509503a8f69',
        },
        {
          $ref: '575ffdce-ed26-41cb-b7a3-972f8dbf7a09',
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
                        $ref: '04430c0e-7782-47e9-9104-7509503a8f69',
                      },
                    },
                    key: '3',
                    pluginId: 'timeseries',
                    title: 'Data',
                    type: 'VizPanel',
                  },
                ],
                key: '0915a0d5-59fd-478a-aeae-5afe62c2c5ef',
                inputParams: {},
                type: 'SceneFlexChild',
              },
              {
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: '04430c0e-7782-47e9-9104-7509503a8f69',
                      },
                    },
                    key: '3',
                    pluginId: 'timeseries',
                    title: 'Data',
                    type: 'VizPanel',
                  },
                ],
                key: '93c01afb-606f-4d20-8fbf-d78bb6a271b8',
                inputParams: {},
                type: 'SceneFlexChild',
              },
            ],
            key: '4f0e1ef6-8d87-4dfb-8369-4dbbacf24731',
            inputParams: {},
            type: 'SceneFlexLayout',
          },
        ],
      },
      actions: [
        {
          inputParams: {
            timeRange: {
              $ref: '575ffdce-ed26-41cb-b7a3-972f8dbf7a09',
            },
          },
          key: '18234f80-3881-4908-bd44-9faa3fc83a6c',
          type: 'SceneTimePicker',
        },
      ],
      isCollapsed: false,
      canCollapse: true,
      canRemove: true,
    },
  },
};

export const basicNestedSceneFromJson = {
  title: 'Nested Scene demo (nested scene only) (from JSON)',
  getScene: () => sceneFromJSON(model),
};
