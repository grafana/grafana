import saveAs from 'file-saver';
import { toCanvas } from 'html-to-image';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

import {
  DataFrame,
  DataTransformerID,
  dateTimeFormat,
  formattedValueToString,
  PanelData,
  PanelModel,
  transformDataFrame,
} from '@grafana/data';
import { getPanelDataFrames } from 'app/features/dashboard/components/HelpWizard/utils';
import { getProcessedData } from 'app/features/inspector/InspectDataTab';
import { getPrettyJSON } from 'app/features/inspector/InspectJSONTab';
import { downloadDataFrameAsCsv } from 'app/features/inspector/utils/download';

import { ExportType, ExportPayload } from './types';

export async function exportSelect(payload: ExportPayload) {
  let preData = payload.data?.series || [];
  let dataFrames = getProcessedData({ withTransforms: true, withFieldConfig: true }, preData, payload.panel);

  const transformer = {
    id: DataTransformerID.joinByField,
    options: { byField: undefined }, // defaults to time field
  };

  if (dataFrames.length > 1) {
    transformDataFrame([transformer], dataFrames).subscribe((data) => {
      dataFrames = data;
    });
  }

  // TODO: Add custom exporting and/or all panel exports

  switch (payload.format) {
    case ExportType.jpeg:
    case ExportType.png:
    case ExportType.bmp:
      const panelCanvas = await toCanvas(payload.htmlElement, {
        style: { transform: 'translate(0px, 0px)' },
      });
      exportImage(panelCanvas, payload.format, payload.panel.title);
      break;
    case ExportType.csv:
      exportCSV(dataFrames[0], payload.panel.title);
      break;
    case ExportType.xlsx:
      exportExcel(dataFrames[0], payload.panel.title);
      break;
    case ExportType.panelJson:
      exportPanelJSON(payload.panel.getSaveModel(), payload.panel.title);
      break;
    case ExportType.dataJson:
      exportDataJSON(payload.data, payload.panel.title);
      break;
    case ExportType.dataFrameJson:
      const panelData = await firstValueFrom(
        payload.panel.getQueryRunner().getData({
          withFieldConfig: false,
          withTransforms: false,
        })
      );
      exportDataJSON(panelData, payload.panel.title);
      break;
  }
}

export function exportCSV(data: DataFrame, title: string) {
  downloadDataFrameAsCsv(data, title);
}

export function exportPanelJSON(panelData: PanelModel, title: string) {
  let blob = new Blob([getPrettyJSON(panelData)], {
    type: 'application/json',
  });

  const fileName = `${title}-${dateTimeFormat(new Date())}.json`;
  saveAs(blob, fileName);
}

export function exportDataJSON(panelData: PanelData | null | undefined, title: string) {
  let jsonData = getPanelDataFrames(panelData);
  const blob = new Blob([getPrettyJSON(jsonData)], {
    type: 'application/json',
  });

  const fileName = `${title}-${dateTimeFormat(new Date())}.json`;
  saveAs(blob, fileName);
}

export function exportExcel(data: DataFrame, title: string) {
  let dataJson = [];

  for (let i = 0; i < data.fields[0].values.length; i++) {
    let dataField: Record<string, string> = {};
    for (let j = 0; j < data.fields.length; j++) {
      const formattedValue = data.fields[j].display!(data.fields[j].values[i]);
      dataField[data.fields[j].name] = formattedValueToString(formattedValue);
    }
    dataJson.push(dataField);
  }

  let dataSheet = XLSX.utils.json_to_sheet(dataJson);
  let xlsxFile = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(xlsxFile, dataSheet, 'People');
  const wbout = XLSX.write(xlsxFile, { type: 'array', bookType: 'xlsx' });

  const blob = new Blob([wbout], {
    type: '',
  });

  const fileName = `${title}-${dateTimeFormat(new Date())}.xlsx`;
  saveAs(blob, fileName);
}

// TODO: maybe borders and/or watermarK?

export async function exportImage(panelCanvas: HTMLCanvasElement, format: ExportType, title: string) {
  const fileName = `${title}-${dateTimeFormat(new Date())}.${format}`;

  panelCanvas.toBlob((blob) => {
    saveAs(blob ?? new Blob(), fileName);
  }, `image/${format}`);
}
