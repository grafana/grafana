import saveAs from 'file-saver';
import * as XLSX from 'xlsx';

import { dateTimeFormat } from '@grafana/data';
import 'jest-canvas-mock';
import { exportCSV, exportDataJSON, exportExcel, exportPanelJSON } from 'app/features/exporter/PanelExporter';

import {
  csvData,
  csvSolution,
  dataJsonData,
  dataJsonSolution,
  excelSolution,
  panelJsonData,
  panelJsonSolution,
} from './PanelExporterTestData';

jest.mock('file-saver', () => jest.fn());

jest.mock('html-to-image', () => ({
  ...jest.requireActual('html-to-image'),
}));

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
      exportPanelJSON(panelJsonData, 'test-title');

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const text = await blob.text();

      expect(text).toEqual(panelJsonSolution);
      expect(filename).toEqual(`test-title-${dateTimeFormat(1400000000000)}.json`);
    });

    it('should download a .json file when presented with data info', async () => {
      exportDataJSON(dataJsonData, 'test-title2');

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const text = await blob.text();

      expect(text).toEqual(dataJsonSolution);
      expect(filename).toEqual(`test-title2-${dateTimeFormat(1400000000000)}.json`);
    });
  });

  describe('exportExcel', () => {
    it('should download a a .xlsx containing the original input JSON data', async () => {
      exportExcel(csvData, 'test-title3');

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

      expect(json).toEqual(excelSolution);
      expect(filename).toEqual(`test-title3-${dateTimeFormat(1400000000000)}.xlsx`);
    });
  });

  describe('ExportCSV', () => {
    it('should download a .csv containing the original input JSON data', async () => {
      exportCSV(csvData, 'test-title4');

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      let text = await blob.text();
      text = text.replaceAll('\r', '');

      expect(text).toMatch(csvSolution);
      expect(filename).toEqual(`test-title4-${dateTimeFormat(1400000000000)}.csv`);
    });
  });

  // Can't test any image exports in this file due to use of canvas - see panel-exporter.spec.ts for e2e tests for them
});
