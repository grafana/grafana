import { sceneFromJSON } from '../core/serialization';

const model = {
  key: '7502c2fd-f87c-44de-841b-0978e950a950',
  title: 'Scene with rows',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: 'ef8e3a1d-3bf3-4c28-87ac-2b40606eecba',
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
      key: '6bc160ab-1ed6-4b2b-a9c8-ca85ee0160c9',
      inputParams: {
        timeRange: {
          $ref: 'ef8e3a1d-3bf3-4c28-87ac-2b40606eecba',
        },
      },
      type: 'SceneDataProviderNode',
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
      key: '98b37db8-8639-4aab-ad56-4f6c8e922bbe',
      inputParams: {
        timeRange: {
          $ref: 'ef8e3a1d-3bf3-4c28-87ac-2b40606eecba',
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
            orientation: 'horizontal',
            key: '42cd6dc8-e81c-42df-a951-ec7bdcb38916',
            inputParams: {},
            type: 'SceneToolbar',
            children: [
              {
                inputParams: {
                  timeRange: {
                    $ref: 'ef8e3a1d-3bf3-4c28-87ac-2b40606eecba',
                  },
                },
                key: 'cb65ab1b-e555-4403-b3a3-c564ed33ef5e',
                type: 'SceneTimePicker',
              },
            ],
          },
          {
            $ref: 'ca59aa4e-1bc0-44d0-b195-5acfa88d778f',
            type: 'NestedScene',
          },
          {
            $ref: '795d9620-b227-4070-88f5-3696f2db5abe',
            type: 'NestedScene',
          },
        ],
        key: '1507c95d-5cdd-42b5-a16e-902bcd6c4ada',
        inputParams: {},
        type: 'SceneFlexLayout',
      },
    ],
    'ca59aa4e-1bc0-44d0-b195-5acfa88d778f': {
      key: 'ca59aa4e-1bc0-44d0-b195-5acfa88d778f',
      title: 'Overview',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          $ref: '6bc160ab-1ed6-4b2b-a9c8-ca85ee0160c9',
        },
        {
          $ref: 'ef8e3a1d-3bf3-4c28-87ac-2b40606eecba',
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
                        $ref: '6bc160ab-1ed6-4b2b-a9c8-ca85ee0160c9',
                      },
                    },
                    pluginId: 'timeseries',
                    title: 'Fill height',
                    key: '4205abe7-e376-4d49-adb2-286f357c0cf3',
                    type: 'VizPanel',
                  },
                ],
                key: 'd6643d92-e069-4e26-af86-6d059ef33208',
                inputParams: {},
                type: 'SceneFlexChild',
              },
              {
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: '6bc160ab-1ed6-4b2b-a9c8-ca85ee0160c9',
                      },
                    },
                    pluginId: 'timeseries',
                    title: 'Fill height',
                    key: 'b917dccf-ad3e-449e-bf94-646f7d139bcc',
                    type: 'VizPanel',
                  },
                ],
                key: '236effb7-a356-40c8-a7ca-7d771287b040',
                inputParams: {},
                type: 'SceneFlexChild',
              },
            ],
            key: '83e722ce-d51d-443b-a521-a323b044c995',
            inputParams: {},
            type: 'SceneFlexLayout',
          },
        ],
      },
      actions: [],
      isCollapsed: false,
      canCollapse: true,
      canRemove: false,
    },
    '795d9620-b227-4070-88f5-3696f2db5abe': {
      key: '795d9620-b227-4070-88f5-3696f2db5abe',
      title: 'More server details',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          $ref: '6bc160ab-1ed6-4b2b-a9c8-ca85ee0160c9',
        },
        {
          $ref: 'ef8e3a1d-3bf3-4c28-87ac-2b40606eecba',
        },
        {
          $ref: '98b37db8-8639-4aab-ad56-4f6c8e922bbe',
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
                        $ref: '6bc160ab-1ed6-4b2b-a9c8-ca85ee0160c9',
                      },
                    },
                    pluginId: 'timeseries',
                    title: 'Fill height',
                    key: '0d286e1f-c364-4698-978e-d1adb455e4a3',
                    type: 'VizPanel',
                  },
                ],
                key: '5fa7132e-ccbb-4761-934e-34245c6f2267',
                inputParams: {},
                type: 'SceneFlexChild',
              },
              {
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: '98b37db8-8639-4aab-ad56-4f6c8e922bbe',
                      },
                    },
                    pluginId: 'table',
                    title: 'Fill height',
                    key: '1fe19ec7-2a1f-41d6-ab9d-d12165482f6d',
                    type: 'VizPanel',
                  },
                ],
                key: 'b8f23779-e10e-4852-a409-4869db67daf9',
                inputParams: {},
                type: 'SceneFlexChild',
              },
            ],
            key: 'dbec4636-ba0d-465d-b9fd-beed7992b4b9',
            inputParams: {},
            type: 'SceneFlexLayout',
          },
        ],
      },
      actions: [],
      isCollapsed: false,
      canCollapse: true,
      canRemove: false,
    },
  },
};

export const sceneWithRowsFromJson = {
  title: 'Scene with rows (from JSON)',
  getScene: () => sceneFromJSON(model),
};
