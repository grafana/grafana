import { sceneFromJSON } from '../core/serialization';

const model = {
  key: '6a68f718-f012-46cc-876d-d9f3544922ed',
  title: 'Scene with rows',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: '6ec67245-1073-4829-8a4f-7469d136ad0f',
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
      key: 'a49c7573-340e-4e80-9c32-5183c51e44eb',
      inputParams: {
        timeRange: {
          $ref: '6ec67245-1073-4829-8a4f-7469d136ad0f',
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
      key: '787de44e-e266-4140-b935-663b3c6a449b',
      inputParams: {
        timeRange: {
          $ref: '6ec67245-1073-4829-8a4f-7469d136ad0f',
        },
      },
      type: 'SceneDataProviderNode',
    },
  ],
  layout: {
    root: [
      {
        direction: 'column',
        key: '20865515-b2e9-4c31-ac2f-31f38a1e112f',
        inputParams: {},
        type: 'SceneFlexLayout',
        children: [
          {
            orientation: 'horizontal',
            key: '73c00ec8-7dcd-4c6e-871b-4ce91d9193c0',
            inputParams: {},
            type: 'SceneToolbar',
            children: [
              {
                $ref: '6ec67245-1073-4829-8a4f-7469d136ad0f',
              },
            ],
          },
          {
            $ref: '350fbf49-5657-4c6e-adc7-f7a7af55b903',
            type: 'NestedScene',
          },
          {
            $ref: 'e665bfdd-8057-4d4b-b719-c487b117ab5b',
            type: 'NestedScene',
          },
        ],
      },
    ],
    '350fbf49-5657-4c6e-adc7-f7a7af55b903': {
      key: '350fbf49-5657-4c6e-adc7-f7a7af55b903',
      title: 'Overview',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          $ref: 'a49c7573-340e-4e80-9c32-5183c51e44eb',
        },
        {
          $ref: '6ec67245-1073-4829-8a4f-7469d136ad0f',
        },
      ],
      layout: {
        root: [
          {
            direction: 'row',
            key: '51186b1f-bc6f-4c73-985b-854a26705ff2',
            inputParams: {},
            type: 'SceneFlexLayout',
            children: [
              {
                key: '2a51c377-bd0b-4360-8ca5-1d057b408056',
                direction: 'row',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: 'a49c7573-340e-4e80-9c32-5183c51e44eb',
                      },
                    },
                    pluginId: 'timeseries',
                    title: 'Fill height',
                    key: 'cdd8e8eb-b462-4de6-9b5d-bf622e655f4d',
                    type: 'VizPanel',
                  },
                ],
              },
              {
                key: 'a5f4eebb-f627-4410-928a-3ed9c12e809b',
                direction: 'row',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: 'a49c7573-340e-4e80-9c32-5183c51e44eb',
                      },
                    },
                    pluginId: 'timeseries',
                    title: 'Fill height',
                    key: '090865c8-e7b6-4802-9ceb-ae27d9b4eaa8',
                    type: 'VizPanel',
                  },
                ],
              },
            ],
          },
        ],
      },
      actions: [],
      isCollapsed: false,
      canCollapse: true,
      canRemove: false,
    },
    'e665bfdd-8057-4d4b-b719-c487b117ab5b': {
      key: 'e665bfdd-8057-4d4b-b719-c487b117ab5b',
      title: 'More server details',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          $ref: 'a49c7573-340e-4e80-9c32-5183c51e44eb',
        },
        {
          $ref: '6ec67245-1073-4829-8a4f-7469d136ad0f',
        },
        {
          $ref: '787de44e-e266-4140-b935-663b3c6a449b',
        },
      ],
      layout: {
        root: [
          {
            direction: 'row',
            key: 'a087cc08-cccc-4eed-b44f-8c2cc687a906',
            inputParams: {},
            type: 'SceneFlexLayout',
            children: [
              {
                key: '3914268c-58c5-412d-bfe7-7f7647fe1ff3',
                direction: 'row',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: 'a49c7573-340e-4e80-9c32-5183c51e44eb',
                      },
                    },
                    pluginId: 'timeseries',
                    title: 'Fill height',
                    key: '64e059ab-a3da-4027-8315-53a99c250175',
                    type: 'VizPanel',
                  },
                ],
              },
              {
                key: 'efb081d4-5ddb-42e9-9181-3ed6d2a2a394',
                direction: 'row',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: '787de44e-e266-4140-b935-663b3c6a449b',
                      },
                    },
                    pluginId: 'table',
                    title: 'Fill height',
                    key: '4043127c-33e8-42c0-9e68-1b6655ce33bc',
                    type: 'VizPanel',
                  },
                ],
              },
            ],
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
