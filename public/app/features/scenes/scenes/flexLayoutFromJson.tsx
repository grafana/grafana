import { sceneFromJSON } from '../core/serialization';

const model = {
  key: '16bd5b77-8090-465b-9d55-20bd1080e9e6',
  title: 'Flex layout test',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      range: {
        from: '2022-09-19T08:55:26.871Z',
        to: '2022-09-19T10:00:23.779Z',
      },
      key: '7118824d-7276-45af-acea-bde9624971fa',
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
      key: '1a2f8c10-3d00-479e-8fc2-0a72d509a1e2',
      inputParams: {
        timeRange: {
          $ref: '7118824d-7276-45af-acea-bde9624971fa',
        },
      },
      type: 'SceneDataProviderNode',
    },
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: 'a1abb778-abaa-4a3e-aee9-d0299b2aa7eb',
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
      key: '7a402123-c5af-4682-9aa7-810bb344567f',
      inputParams: {
        timeRange: {
          $ref: 'a1abb778-abaa-4a3e-aee9-d0299b2aa7eb',
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
            direction: 'column',
            children: [
              {
                size: {
                  ySizing: 'content',
                },
                children: [
                  {
                    orientation: 'horizontal',
                    key: '821280c3-82d8-4f97-be6e-3678113d814a',
                    inputParams: {},
                    type: 'SceneToolbar',
                    children: [
                      {
                        inputParams: {
                          timeRange: {
                            $ref: '7118824d-7276-45af-acea-bde9624971fa',
                          },
                        },
                        key: '550b1710-a59d-4d9f-b81b-26d5e73d13e0',
                        type: 'SceneTimePicker',
                      },
                    ],
                  },
                ],
                key: '05053e11-c2db-4e00-9aa6-b8786d188449',
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
                                $ref: '1a2f8c10-3d00-479e-8fc2-0a72d509a1e2',
                              },
                            },
                            pluginId: 'timeseries',
                            title: 'Title',
                            options: {
                              legend: {
                                displayMode: 'hidden',
                              },
                            },
                            key: 'd2dbb9d0-efd8-495d-8994-e890e8f320e2',
                            type: 'VizPanel',
                          },
                        ],
                        key: '1fda2fd4-1ab6-4c98-b988-4fa0f76c7cd1',
                        inputParams: {},
                        type: 'SceneFlexChild',
                      },
                      {
                        children: [
                          {
                            inputParams: {
                              data: {
                                $ref: '1a2f8c10-3d00-479e-8fc2-0a72d509a1e2',
                              },
                            },
                            pluginId: 'timeseries',
                            title: 'Title',
                            options: {
                              legend: {
                                displayMode: 'hidden',
                              },
                            },
                            key: '0db32fa2-3010-4db0-8998-0d7537916bea',
                            type: 'VizPanel',
                          },
                        ],
                        key: 'e3c96749-1e58-4968-a3f8-70b87967c3b6',
                        inputParams: {},
                        type: 'SceneFlexChild',
                      },
                    ],
                    key: '352498d6-3c20-445a-adad-b7c8d35122de',
                    inputParams: {},
                    type: 'SceneFlexLayout',
                  },
                ],
                key: '70853230-43fe-4fe5-8709-1e8089bc9258',
                inputParams: {},
                type: 'SceneFlexChild',
              },
            ],
            key: 'a251a9f2-2289-4253-af8c-476247f73213',
            inputParams: {},
            type: 'SceneFlexLayout',
          },
          {
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
                        key: '48ea926a-1915-404d-a6f0-d1e5cc7d4bfb',
                        inputParams: {},
                        type: 'SceneToolbar',
                        children: [
                          {
                            inputParams: {
                              timeRange: {
                                $ref: 'a1abb778-abaa-4a3e-aee9-d0299b2aa7eb',
                              },
                            },
                            key: '85b42977-6600-472f-b46a-fd755abe9ee7',
                            type: 'SceneTimePicker',
                          },
                        ],
                      },
                    ],
                    key: 'd32d8c28-9b7e-4f79-a671-2e096b2a52a3',
                    inputParams: {},
                    type: 'SceneFlexChild',
                  },
                  {
                    children: [
                      {
                        inputParams: {
                          data: {
                            $ref: '7a402123-c5af-4682-9aa7-810bb344567f',
                          },
                        },
                        pluginId: 'timeseries',
                        title: 'Title',
                        options: {
                          legend: {
                            displayMode: 'hidden',
                          },
                        },
                        key: 'ec680b52-5f5b-4c50-8ccd-defe9a9dad40',
                        type: 'VizPanel',
                      },
                    ],
                    key: '84757e20-fa72-4ff1-86ad-34ee6a3a7752',
                    inputParams: {},
                    type: 'SceneFlexChild',
                  },
                ],
                key: '20d4a36d-b928-4f7c-84d5-0ac83cf7c0cd',
                inputParams: {},
                type: 'SceneFlexLayout',
              },
            ],
            key: '27f0df28-6574-4cff-9204-93cda610251f',
            inputParams: {},
            type: 'SceneFlexChild',
          },
        ],
        key: '1bca8e25-1f67-42fc-aebb-06f25553d92b',
        inputParams: {},
        type: 'SceneFlexLayout',
      },
    ],
  },
};

export const flexLayoutFromJSON = {
  title: 'Flex layout (from JSON)',
  getScene: () => sceneFromJSON(model),
};
