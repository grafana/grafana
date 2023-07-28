import saveAs from 'file-saver';
import * as XLSX from 'xlsx';

import { dateTimeFormat, FieldType, getDefaultTimeRange, LoadingState, PanelData } from '@grafana/data';
import 'jest-canvas-mock';
import { exportCSV, exportDataJSON, exportExcel, exportPanelJSON } from 'app/features/exporter/PanelExporter';

import { PanelModel } from '../dashboard/state/PanelModel';
import { getProcessedData } from '../inspector/InspectDataTab';

jest.mock('file-saver', () => jest.fn());

jest.mock('html-to-image', () => ({
  ...jest.requireActual('html-to-image'),
}));

const panelData: PanelData = {
  series: [],
  timeRange: getDefaultTimeRange(),
  state: LoadingState.Done,
};

const panelData2 = {
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

const panelData2sol = `{
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

const preData = [
  {
    fields: [
      { name: 'time', type: FieldType.time, values: [0, 1, 2], config: { interval: 1 } },
      { name: 'value', type: FieldType.number, values: [3, 4, 5], config: {} },
    ],
    length: 3,
  },
];

let dataFrames = getProcessedData(
  { withTransforms: true, withFieldConfig: true },
  preData,
  new PanelModel({ id: 1, title: 'test-title4' })
);

const csvSol = `"time","value"
1969-12-31 18:00:00.000,3
1969-12-31 18:00:00.001,4
1969-12-31 18:00:00.002,5`;

// TODO: Reconfigure prior data and expected solutions

describe('Panel-Exporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(1400000000000) });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('exportJSON', () => {
    it('should download a .json file when presented with panel info', async () => {
      exportPanelJSON(panelData2, 'test-title');

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const text = await blob.text();

      expect(text).toEqual(panelData2sol);
      expect(filename).toEqual(`test-title-${dateTimeFormat(1400000000000)}.json`);
    });

    it('should download a .json file when presented with data info', async () => {
      exportDataJSON(panelData, 'test-title2');

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const text = await blob.text();

      expect(text).toEqual('[]');
      expect(filename).toEqual(`test-title2-${dateTimeFormat(1400000000000)}.json`);
    });
  });

  describe('exportExcel', () => {
    it('should download a a .xlsx containing the original input JSON data', async () => {
      exportExcel(dataFrames[0], 'test-title3');

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const fileReader = new FileReader();

      const data = await new Promise((resolve, reject) => {
        fileReader.onerror = () => {
          fileReader.abort();
          reject(new DOMException('Failed to read file.'));
        };

        fileReader.onload = () => {
          resolve(fileReader.result);
        };
        fileReader.readAsBinaryString(blob);
      });

      let workbook = XLSX.read(data, { type: 'binary' });
      const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      const sol = JSON.parse(
        `[{"time": "1969-12-31 18:00:00.000", "value": "3"}, {"time": "1969-12-31 18:00:00.001", "value": "4"}, {"time": "1969-12-31 18:00:00.002", "value": "5"}]`
      );

      expect(json).toEqual(sol);
      expect(filename).toEqual(`test-title3-${dateTimeFormat(1400000000000)}.xlsx`);
    });
  });

  describe('ExportCSV', () => {
    it('should download a .csv containing the original input JSON data', async () => {
      exportCSV(dataFrames[0], 'test-title4');

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      let text = await blob.text();
      text = text.replaceAll('\r', '');

      expect(text).toMatch(csvSol);
      expect(filename).toEqual(`test-title4-${dateTimeFormat(1400000000000)}.csv`);
    });
  });

  // Can't test any image exports in this file due to use of canvas - see panel-exporter.spec.ts for e2e tests
});
