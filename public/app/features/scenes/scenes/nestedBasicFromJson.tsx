import { sceneFromJSON } from '../core/serialization';

const model = {
  key: '58ffac0b-62bf-4673-9409-eeeac921a19b',
  title: 'Nested Scene demo (from JSON)',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      key: '94d745c9-7c8e-4234-bd98-e620ee643a61',
      inputParams: {},
      type: 'SceneTimeRange',
      range: {
        from: 'now-6h',
        to: 'now',
      },
    },
    {
      key: 'a3ebb3ff-dce8-40bd-8ef3-066fdbdeb7fa',
      inputParams: {
        timeRange: { $ref: '94d745c9-7c8e-4234-bd98-e620ee643a61' },
      },
      type: 'SceneDataProviderNode',
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
    },
  ],
  layout: {
    root: [
      {
        direction: 'column',
        key: '8d42de22-be9a-417e-b42c-634959ab7af4',
        type: 'SceneFlexLayout',
        children: [
          {
            $ref: 'b30b9a3e-7112-4279-be52-00a913d161a0',
            type: 'NestedScene',
          },
        ],
      },
    ],
    'b30b9a3e-7112-4279-be52-00a913d161a0': {
      key: 'b30b9a3e-7112-4279-be52-00a913d161a0',
      title: 'Inner scene',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          key: 'a3ebb3ff-dce8-40bd-8ef3-066fdbdeb7fa',
          inputParams: {
            timeRange: { $ref: '94d745c9-7c8e-4234-bd98-e620ee643a61' },
          },
          type: 'SceneDataProviderNode',
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
        },
        {
          key: '94d745c9-7c8e-4234-bd98-e620ee643a61',
          inputParams: {},
          type: 'SceneTimeRange',
          range: {
            from: 'now-6h',
            to: 'now',
          },
        },
      ],
      layout: {
        root: [
          {
            direction: 'row',
            key: 'b19e3502-3d3d-421d-9659-d32a05598630',
            type: 'SceneFlexLayout',
            children: [
              {
                key: '45772c3d-57b8-4bbc-b233-7338c720652a',
                direction: 'row',
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: { $ref: 'a3ebb3ff-dce8-40bd-8ef3-066fdbdeb7fa' },
                    },
                    key: '3',
                    pluginId: 'timeseries',
                    title: 'Data',
                    type: 'VizPanel',
                  },
                ],
              },
              {
                key: '1d29a557-8ae9-4891-844d-602d4dccf39f',
                direction: 'row',
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: { $ref: 'a3ebb3ff-dce8-40bd-8ef3-066fdbdeb7fa' },
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
          $ref: '94d745c9-7c8e-4234-bd98-e620ee643a61',
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
