import { sceneFromJSON } from '../core/serialization';

const model = {
  key: '8260a9bb-1990-40c1-9217-8d2b68d88bee',
  title: 'Transformation node test',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: 'a633f512-8b5c-4fee-ac0f-23296fadbd5f',
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
      key: 'd36a8080-0ffb-4b68-8cc8-53eff4dc75ec',
      inputParams: {
        timeRange: {
          $ref: 'a633f512-8b5c-4fee-ac0f-23296fadbd5f',
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
      key: 'a5d87ae5-197c-4868-8a41-f1d460182e2b',
      inputParams: {
        data: {
          $ref: '5034821a-4fb0-4e43-86d3-3def301077f9',
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
      key: '5034821a-4fb0-4e43-86d3-3def301077f9',
      inputParams: {
        data: {
          $ref: 'd36a8080-0ffb-4b68-8cc8-53eff4dc75ec',
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
      key: '31a643bb-c67c-4d63-8fde-19bf4eb84115',
      inputParams: {
        data: {
          $ref: '5034821a-4fb0-4e43-86d3-3def301077f9',
        },
      },
      type: 'SceneDataTransformationNode',
    },
  ],
  layout: {
    root: [
      {
        direction: 'column',
        children: [
          {
            direction: 'column',
            children: [
              {
                size: {
                  ySizing: 'content',
                },
                children: [
                  {
                    orientation: 'horizontal',
                    key: '81f96d5d-a501-48f2-b170-cdc2f34ab87d',
                    inputParams: {},
                    type: 'SceneToolbar',
                    children: [
                      {
                        inputParams: {
                          timeRange: {
                            $ref: 'a633f512-8b5c-4fee-ac0f-23296fadbd5f',
                          },
                        },
                        key: '58be7e63-6d48-4918-a6ec-c351dd4fcabe',
                        type: 'SceneTimePicker',
                      },
                    ],
                  },
                ],
                key: '525918eb-0873-4981-9d12-c207972e3d29',
                inputParams: {},
                type: 'SceneFlexChild',
              },
              {
                children: [
                  {
                    direction: 'row',
                    children: [
                      {
                        children: [
                          {
                            inputParams: {
                              data: {
                                $ref: 'd36a8080-0ffb-4b68-8cc8-53eff4dc75ec',
                              },
                            },
                            pluginId: 'timeseries',
                            title: 'Raw data',
                            options: {
                              legend: {
                                displayMode: 'hidden',
                              },
                            },
                            key: 'bf6e25f7-da0c-4da6-9d14-532fdb088821',
                            type: 'VizPanel',
                          },
                        ],
                        key: 'bc68a3e0-4dae-4626-aab0-9462f6e9eca6',
                        inputParams: {},
                        type: 'SceneFlexChild',
                      },
                      {
                        children: [
                          {
                            inputParams: {
                              data: {
                                $ref: 'a5d87ae5-197c-4868-8a41-f1d460182e2b',
                              },
                            },
                            pluginId: 'stat',
                            title: 'Limit + reduce',
                            key: 'b223758a-6a0c-43e4-a29d-c40bfce4277c',
                            type: 'VizPanel',
                          },
                        ],
                        key: '8c8db9f5-40b0-4b24-802e-642dd05ab757',
                        inputParams: {},
                        type: 'SceneFlexChild',
                      },
                      {
                        children: [
                          {
                            inputParams: {
                              data: {
                                $ref: '31a643bb-c67c-4d63-8fde-19bf4eb84115',
                              },
                            },
                            pluginId: 'table',
                            title: 'Reduce + organize',
                            key: 'e2928ed4-892a-4139-9668-f98b68e87816',
                            type: 'VizPanel',
                          },
                        ],
                        key: '6432acc4-a3a8-4789-a65d-0f5e36c1a678',
                        inputParams: {},
                        type: 'SceneFlexChild',
                      },
                    ],
                    key: '1c060815-6aa7-4713-9856-4f53140d45c7',
                    inputParams: {},
                    type: 'SceneFlexLayout',
                  },
                ],
                key: 'f0e40d13-7d67-4e0d-8dac-0d02966466c9',
                inputParams: {},
                type: 'SceneFlexChild',
              },
              {
                $ref: '8f379d1e-c4e3-4c04-9906-672cdae7b49a',
                type: 'NestedScene',
              },
            ],
            key: '56bfc1aa-53b6-498b-b7f6-97408f062ffa',
            inputParams: {},
            type: 'SceneFlexLayout',
          },
        ],
        key: 'bcf7e548-59b4-4db6-a08a-dfdff126d270',
        inputParams: {},
        type: 'SceneFlexLayout',
      },
    ],
    '8f379d1e-c4e3-4c04-9906-672cdae7b49a': {
      key: '8f379d1e-c4e3-4c04-9906-672cdae7b49a',
      title: 'Nested transformation',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          $ref: '31a643bb-c67c-4d63-8fde-19bf4eb84115',
        },
        {
          $ref: '5034821a-4fb0-4e43-86d3-3def301077f9',
        },
        {
          $ref: 'd36a8080-0ffb-4b68-8cc8-53eff4dc75ec',
        },
        {
          $ref: 'a633f512-8b5c-4fee-ac0f-23296fadbd5f',
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
                        $ref: '31a643bb-c67c-4d63-8fde-19bf4eb84115',
                      },
                    },
                    pluginId: 'table',
                    title: 'Chained transformers: reduce + organize',
                    options: {},
                    key: 'dc5b64dd-5b21-4203-8dba-005f76320782',
                    type: 'VizPanel',
                  },
                ],
                key: '490843fa-960c-4231-8891-fcf6abe91349',
                inputParams: {},
                type: 'SceneFlexChild',
              },
              {
                children: [
                  {
                    inputParams: {
                      data: {
                        $ref: 'd36a8080-0ffb-4b68-8cc8-53eff4dc75ec',
                      },
                    },
                    pluginId: 'table',
                    title: 'Raw data',
                    options: {},
                    key: '8a5bf59c-891e-4f27-8898-32762b13caab',
                    type: 'VizPanel',
                  },
                ],
                key: '50e85a73-efcb-4838-b701-cef9cf8b137c',
                inputParams: {},
                type: 'SceneFlexChild',
              },
            ],
            key: '46193663-5df6-4f68-affe-38356ddc98bb',
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

export const transformationsDemoFromJson = {
  title: 'Transformation node test (from JSON)',
  getScene: () => sceneFromJSON(model),
};
