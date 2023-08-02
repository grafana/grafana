import { DataFrame, FieldType, getDefaultTimeRange, LoadingState, PanelData } from '@grafana/data';

import { PanelModel } from '../dashboard/state/PanelModel';
import { getProcessedData } from '../inspector/InspectDataTab';

//======= INPUT DATA =======

export const panelJsonData = {
  // no type as from PanelModel.ts
  datasource: { type: 'testdata', uid: 'a1234-567b' },
  fieldConfig: { defaults: {}, overrides: [] },
  gridPos: { h: 3, w: 6, x: 0, y: 0 },
  id: 0,
  options: { reduceOptions: {}, tooltip: { mode: 'single', sort: 'none' } },
  targets: [
    {
      alias: 'Foo',
      labels: 'bar',
      refId: 'A',
      scenarioId: 'random_walk',
    },
  ],
  title: 'test-title',
  type: 'timeseries',
};

const unprocessedCsvData: DataFrame[] = [
  {
    fields: [
      { name: 'time', type: FieldType.time, values: [0, 1, 2], config: { interval: 1 } },
      { name: 'value', type: FieldType.number, values: [3, 4, 5], config: {} },
    ],
    length: 3,
  },
];

export const dataJsonData: PanelData = {
  series: unprocessedCsvData,
  timeRange: getDefaultTimeRange(),
  state: LoadingState.Done,
};

export const csvData: DataFrame = getProcessedData(
  { withTransforms: true, withFieldConfig: true },
  unprocessedCsvData,
  new PanelModel({ id: 1, title: 'test-title4' })
)[0];

//======= SOLUTIONS =======

export const panelJsonSolution = `{
  "datasource": {
    "type": "testdata",
    "uid": "a1234-567b"
  },
  "fieldConfig": {
    "defaults": {},
    "overrides": []
  },
  "gridPos": {
    "h": 3,
    "w": 6,
    "x": 0,
    "y": 0
  },
  "id": 0,
  "options": {
    "reduceOptions": {},
    "tooltip": {
      "mode": "single",
      "sort": "none"
    }
  },
  "targets": [
    {
      "alias": "Foo",
      "labels": "bar",
      "refId": "A",
      "scenarioId": "random_walk"
    }
  ],
  "title": "test-title",
  "type": "timeseries"
}`;

export const dataJsonSolution = `[
  {
    "schema": {
      "fields": [
        {
          "name": "time",
          "type": "time",
          "config": {
            "interval": 1
          }
        },
        {
          "name": "value",
          "type": "number",
          "config": {}
        }
      ]
    },
    "data": {
      "values": [
        [
          0,
          1,
          2
        ],
        [
          3,
          4,
          5
        ]
      ]
    }
  }
]`;

export const csvSolution = `"time","value"
1969-12-31 18:00:00.000,3
1969-12-31 18:00:00.001,4
1969-12-31 18:00:00.002,5`;

export const excelSolution = JSON.parse(
  `[{"time": "1969-12-31 18:00:00.000", "value": "3"}, {"time": "1969-12-31 18:00:00.001", "value": "4"}, {"time": "1969-12-31 18:00:00.002", "value": "5"}]`
);
