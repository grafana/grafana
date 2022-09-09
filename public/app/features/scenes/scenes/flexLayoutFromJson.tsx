import { sceneFromJSON } from '../core/serialization';

const model = {
  key: '14583b00-37d9-43a7-b6eb-05f98a569710',
  title: 'Flex layout test (from JSON)',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      key: '01d4b949-0ea8-4430-b478-392b829d1605',
      inputParams: {},
      type: 'SceneTimeRange',
      range: {
        from: 'now-6h',
        to: 'now',
      },
    },
    {
      key: '4ec67e47-3dc3-4c5a-babb-c815f14dbadf',
      inputParams: {
        timeRange: '01d4b949-0ea8-4430-b478-392b829d1605',
      },
      type: 'SceneDataProviderNode',
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
    },
    {
      key: '7df4af7f-b55b-40aa-8bd1-e2d2ec3a4ccf',
      inputParams: {},
      type: 'SceneTimeRange',
      range: {
        from: 'now-6h',
        to: 'now',
      },
    },
    {
      key: '6d7c1fa4-0205-46ab-adee-56ab786a44bf',
      inputParams: {
        timeRange: '7df4af7f-b55b-40aa-8bd1-e2d2ec3a4ccf',
      },
      type: 'SceneDataProviderNode',
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
    },
  ],
  layout: {
    root: [
      {
        direction: 'column',
        key: '39bf5291-6f7c-4e99-9467-0c24b5983055',
        type: 'SceneFlexLayout',
        children: [
          {
            direction: 'column',
            key: '9e796c57-9a1d-4909-b0a2-eee301699a85',
            type: 'SceneFlexLayout',
            children: [
              {
                size: {
                  ySizing: 'content',
                },
                key: '6338ee7d-e8c7-46b0-b070-673a8f618e3c',
                direction: 'column',
                type: 'SceneFlexChild',
                children: [
                  {
                    orientation: 'horizontal',
                    key: 'da3a8142-8bf4-46f7-b9cf-1e7ed2b01779',
                    type: 'SceneToolbar',
                    children: [
                      {
                        $ref: '01d4b949-0ea8-4430-b478-392b829d1605',
                      },
                    ],
                  },
                ],
              },
              {
                key: '9aa3484f-d2b7-4be0-8d62-d151990c8708',
                direction: 'column',
                type: 'SceneFlexChild',
                children: [
                  {
                    direction: 'row',
                    key: '0918a48e-b66d-423b-8b9b-907939352bb5',
                    type: 'SceneFlexLayout',
                    children: [
                      {
                        key: 'f370c1d4-7f24-47ff-9c23-0190fb3403c6',
                        direction: 'row',
                        type: 'SceneFlexChild',
                        children: [
                          {
                            inputParams: {
                              data: '4ec67e47-3dc3-4c5a-babb-c815f14dbadf',
                            },
                            pluginId: 'timeseries',
                            title: 'Title',
                            options: {
                              legend: {
                                displayMode: 'hidden',
                              },
                            },
                            key: '00e55d87-d8fe-47eb-8b8a-b3bbcd9429e4',
                            type: 'VizPanel',
                          },
                        ],
                      },
                      {
                        key: '251d29a0-f968-459f-8928-78e455d97d15',
                        direction: 'row',
                        type: 'SceneFlexChild',
                        children: [
                          {
                            inputParams: {
                              data: '4ec67e47-3dc3-4c5a-babb-c815f14dbadf',
                            },
                            pluginId: 'timeseries',
                            title: 'Title',
                            options: {
                              legend: {
                                displayMode: 'hidden',
                              },
                            },
                            key: 'c2289bf9-a9f7-4408-ab1d-8f07c1a8d43c',
                            type: 'VizPanel',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            key: '63d8e57c-2346-4a2e-b2a6-6dc637938dbb',
            direction: 'column',
            type: 'SceneFlexChild',
            children: [
              {
                direction: 'column',
                key: '7c4915a7-efce-498c-a2eb-245ef4d28bdc',
                type: 'SceneFlexLayout',
                children: [
                  {
                    size: {
                      ySizing: 'content',
                    },
                    key: '99f41002-7168-49a1-b522-603c664bc59c',
                    direction: 'column',
                    type: 'SceneFlexChild',
                    children: [
                      {
                        orientation: 'horizontal',
                        key: '0c35e591-b594-403d-a66d-9f4b05471453',
                        type: 'SceneToolbar',
                        children: [
                          {
                            $ref: '7df4af7f-b55b-40aa-8bd1-e2d2ec3a4ccf',
                          },
                        ],
                      },
                    ],
                  },
                  {
                    key: '32692525-3547-48a9-8792-e9622bc5accb',
                    direction: 'column',
                    type: 'SceneFlexChild',
                    children: [
                      {
                        inputParams: {
                          data: '6d7c1fa4-0205-46ab-adee-56ab786a44bf',
                        },
                        pluginId: 'timeseries',
                        title: 'Title',
                        options: {
                          legend: {
                            displayMode: 'hidden',
                          },
                        },
                        key: 'dfe5cf96-797b-4f17-9e43-42df62c3b82e',
                        type: 'VizPanel',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export const flexLayoutFromJSON = {
  title: 'Flex layout (from JSON)',
  getScene: () => sceneFromJSON(model),
};
