import { sceneFromJSON } from '../core/serialization';

const model = {
  key: '0b682774-d920-40b4-a557-534779e0096d',
  title: 'Scene with rows',
  data: 'TODO: serialize Scene data?',
  inputs: [
    {
      range: {
        from: 'now-6h',
        to: 'now',
      },
      key: 'cd283c30-eed4-4356-83ca-940ef999ee8f',
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
      key: 'd431ea9e-d4b0-4a2d-b996-705de7c54cc0',
      inputParams: {
        timeRange: 'cd283c30-eed4-4356-83ca-940ef999ee8f',
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
      key: 'b73b42be-5b10-48f5-a3ef-8a70ba927389',
      inputParams: {
        timeRange: 'cd283c30-eed4-4356-83ca-940ef999ee8f',
      },
      type: 'SceneDataProviderNode',
    },
  ],
  layout: {
    root: [
      {
        direction: 'column',
        key: '28c11f32-d1b6-4467-99bb-b2873e5969ef',
        inputParams: {},
        type: 'SceneFlexLayout',
        children: [
          {
            orientation: 'horizontal',
            key: '3b1f4a64-8bcc-4758-9f3e-2ce82e0e7f96',
            inputParams: {},
            type: 'SceneToolbar',
            children: [
              {
                $ref: 'cd283c30-eed4-4356-83ca-940ef999ee8f',
              },
            ],
          },
          {
            $ref: '98856378-eaaa-4c77-8cc9-e321a6a7a881',
            type: 'NestedScene',
          },
          {
            $ref: '3caabbca-d3a3-404e-a06c-2709cace2431',
            type: 'NestedScene',
          },
        ],
      },
    ],
    '98856378-eaaa-4c77-8cc9-e321a6a7a881': {
      key: '98856378-eaaa-4c77-8cc9-e321a6a7a881',
      title: 'Overview',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          $ref: 'd431ea9e-d4b0-4a2d-b996-705de7c54cc0',
        },
        {
          $ref: 'cd283c30-eed4-4356-83ca-940ef999ee8f',
        },
      ],
      layout: {
        root: [
          {
            direction: 'row',
            key: 'c2028b1b-7993-4aad-b83e-ea8633ce6102',
            inputParams: {},
            type: 'SceneFlexLayout',
            children: [
              {
                key: 'ed2dfc10-eb68-4057-ba5b-7f7a279f4ece',
                direction: 'row',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: 'd431ea9e-d4b0-4a2d-b996-705de7c54cc0',
                    },
                    pluginId: 'timeseries',
                    title: 'Fill height',
                    key: '66154671-85cc-49ba-8e07-78538a495e15',
                    type: 'VizPanel',
                  },
                ],
              },
              {
                key: '8364cd8e-fcf3-4d61-b055-b7e9524032b3',
                direction: 'row',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: 'd431ea9e-d4b0-4a2d-b996-705de7c54cc0',
                    },
                    pluginId: 'timeseries',
                    title: 'Fill height',
                    key: 'fd48daf2-2b69-44ea-ab6b-78f7a0aeb885',
                    type: 'VizPanel',
                  },
                ],
              },
            ],
          },
        ],
      },
      isCollapsed: false,
      canCollapse: true,
    },
    '3caabbca-d3a3-404e-a06c-2709cace2431': {
      key: '3caabbca-d3a3-404e-a06c-2709cace2431',
      title: 'More server details',
      data: 'TODO: serialize Scene data?',
      inputs: [
        {
          $ref: 'd431ea9e-d4b0-4a2d-b996-705de7c54cc0',
        },
        {
          $ref: 'cd283c30-eed4-4356-83ca-940ef999ee8f',
        },
        {
          $ref: 'b73b42be-5b10-48f5-a3ef-8a70ba927389',
        },
      ],
      layout: {
        root: [
          {
            direction: 'row',
            key: 'be5d01cf-909f-49b6-8751-b2022338967a',
            inputParams: {},
            type: 'SceneFlexLayout',
            children: [
              {
                key: '35a1caec-8e70-4007-84c6-658ab016aa97',
                direction: 'row',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: 'd431ea9e-d4b0-4a2d-b996-705de7c54cc0',
                    },
                    pluginId: 'timeseries',
                    title: 'Fill height',
                    key: '7d161694-72ac-41d1-9763-95f8335fe916',
                    type: 'VizPanel',
                  },
                ],
              },
              {
                key: 'f79a8fea-c709-45da-bc49-eed364c06051',
                direction: 'row',
                inputParams: {},
                type: 'SceneFlexChild',
                children: [
                  {
                    inputParams: {
                      data: 'b73b42be-5b10-48f5-a3ef-8a70ba927389',
                    },
                    pluginId: 'table',
                    title: 'Fill height',
                    key: 'edfd755c-5ccf-470f-b6d6-5130adc0bdd5',
                    type: 'VizPanel',
                  },
                ],
              },
            ],
          },
        ],
      },
      canCollapse: true,
    },
  },
};

export const sceneWithRowsFromJson = {
  title: 'Scene with rows (from JSON)',
  getScene: () => sceneFromJSON(model),
};
