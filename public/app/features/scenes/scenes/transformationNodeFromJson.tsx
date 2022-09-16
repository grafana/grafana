import { sceneFromJSON } from '../core/serialization';

const model = {
  key: '8cb33252-e13a-4d6b-9426-cc3dd039e164',
  title: 'Transformation node test (from JSON)',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: 'de67bcd1-c62e-48ff-9e9a-20f1ad3fdae3',
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
      key: '651e7ad3-5c14-4d88-88ad-f5764061bb6e',
      inputParams: {
        timeRange: {
          $ref: 'de67bcd1-c62e-48ff-9e9a-20f1ad3fdae3',
        },
      },
      type: 'SceneDataProviderNode',
    },
    {
      transformations: [
        {
          id: 'reduce',
          options: {
            reducers: ['mean'],
          },
        },
      ],
      key: 'd07c0418-e622-49a0-a685-2d0c0cbf3939',
      inputParams: {
        data: {
          $ref: 'cbd6da86-79e5-4543-b23c-e7808c0fb1da',
        },
      },
      type: 'SceneDataTransformationNode',
    },
    {
      transformations: [
        {
          id: 'limit',
          options: {
            limitField: 100,
          },
        },
      ],
      key: 'cbd6da86-79e5-4543-b23c-e7808c0fb1da',
      inputParams: {
        data: {
          $ref: '651e7ad3-5c14-4d88-88ad-f5764061bb6e',
        },
      },
      type: 'SceneDataTransformationNode',
    },
    {
      transformations: [
        {
          id: 'reduce',
          options: {
            reducers: ['min', 'max', 'mean'],
          },
        },
        {
          id: 'organize',
          options: {
            excludeByName: {
              Field: true,
            },
          },
        },
      ],
      key: '4fdb9db5-6a4b-4b17-88bc-887f5a304949',
      inputParams: {
        data: {
          $ref: 'cbd6da86-79e5-4543-b23c-e7808c0fb1da',
        },
      },
      type: 'SceneDataTransformationNode',
    },
  ],
  layout: {
    root: [
      {
        direction: 'column',
        key: '7f1b38b5-2cd0-43ca-ba6d-fbed0cd7a416',
        inputParams: {},
        type: 'SceneFlexLayout',
        children: [
          {
            direction: 'column',
            key: 'a2291f32-5537-4181-b040-43b1385bf22d',
            inputParams: {},
            type: 'SceneFlexLayout',
            children: [
              {
                size: {
                  ySizing: 'content',
                },
                key: '25300a62-243c-4a81-9dde-9e226c8d2334',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    orientation: 'horizontal',
                    key: '7dd2fd45-4fec-4e25-a23f-feaea1c27830',
                    inputParams: {},
                    type: 'SceneToolbar',
                    children: [
                      {
                        $ref: 'de67bcd1-c62e-48ff-9e9a-20f1ad3fdae3',
                      },
                    ],
                  },
                ],
              },
              {
                key: '64616e28-5310-40ee-a2cd-ff5eda7af9f6',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    direction: 'row',
                    key: 'c12d4ed2-5db4-4d33-a86f-c5add03de5ff',
                    inputParams: {},
                    type: 'SceneFlexLayout',
                    children: [
                      {
                        key: '28fd4b97-9505-4595-ae88-643f4d6d0197',
                        inputParams: {},
                        type: 'SceneFlexChild',
                        children: [
                          {
                            inputParams: {
                              data: {
                                $ref: '651e7ad3-5c14-4d88-88ad-f5764061bb6e',
                              },
                            },
                            pluginId: 'timeseries',
                            title: 'Raw data',
                            options: {
                              legend: {
                                displayMode: 'hidden',
                              },
                            },
                            key: 'b367ea97-f29f-48b9-be17-157a9f80b2df',
                            type: 'VizPanel',
                          },
                        ],
                      },
                      {
                        key: '73f404c6-49d6-4feb-a48b-fbd7d5fb76e8',
                        inputParams: {},
                        type: 'SceneFlexChild',
                        children: [
                          {
                            inputParams: {
                              data: {
                                $ref: 'd07c0418-e622-49a0-a685-2d0c0cbf3939',
                              },
                            },
                            pluginId: 'stat',
                            title: 'Limit + reduce',
                            key: '12b1ae5b-e629-4754-88c8-89115de90c41',
                            type: 'VizPanel',
                          },
                        ],
                      },
                      {
                        key: 'e95c5675-8b0e-4bbc-8d6c-a2897e3ab6fc',
                        inputParams: {},
                        type: 'SceneFlexChild',
                        children: [
                          {
                            inputParams: {
                              data: {
                                $ref: '4fdb9db5-6a4b-4b17-88bc-887f5a304949',
                              },
                            },
                            pluginId: 'table',
                            title: 'Reduce + organize',
                            key: '25710d0e-5cb3-4f67-9982-f659d6678437',
                            type: 'VizPanel',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                $ref: 'bcdc7867-7ba3-47ae-afdc-b3bb90ff37e1',
                type: 'NestedScene',
              },
            ],
          },
        ],
      },
    ],
    'bcdc7867-7ba3-47ae-afdc-b3bb90ff37e1': {
      key: 'bcdc7867-7ba3-47ae-afdc-b3bb90ff37e1',
      title: 'Nested transformation',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          $ref: '4fdb9db5-6a4b-4b17-88bc-887f5a304949',
        },
        {
          $ref: 'cbd6da86-79e5-4543-b23c-e7808c0fb1da',
        },
        {
          $ref: '651e7ad3-5c14-4d88-88ad-f5764061bb6e',
        },
        {
          $ref: 'de67bcd1-c62e-48ff-9e9a-20f1ad3fdae3',
        },
      ],
      layout: {
        root: [
          {
            direction: 'row',
            key: '50855d58-a50b-489e-88c6-69b13e82bcc5',
            inputParams: {},
            type: 'SceneFlexLayout',
            children: [
              {
                key: '6ab68215-88e4-43e5-be3a-193911a0383b',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: '4fdb9db5-6a4b-4b17-88bc-887f5a304949',
                      },
                    },
                    pluginId: 'table',
                    title: 'Chained transformers: reduce + organize',
                    options: {},
                    key: '3cba0583-de78-4686-81c1-3ed45794240f',
                    type: 'VizPanel',
                  },
                ],
              },
              {
                key: 'c103747e-5156-433d-aa38-efb4bbbd521e',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: '651e7ad3-5c14-4d88-88ad-f5764061bb6e',
                      },
                    },
                    pluginId: 'table',
                    title: 'Raw data',
                    options: {},
                    key: 'a4eba661-d2fe-4f50-8761-71e0dbe15857',
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

export const transformationsDemoFromJson = {
  title: 'Transformation node test (from JSON)',
  getScene: () => sceneFromJSON(model),
};
