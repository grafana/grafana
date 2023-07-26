import domtoimage from 'dom-to-image';
import saveAs from 'file-saver';
import { toCanvas } from 'html-to-image';
import html2canvas from 'html2canvas';
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
  const preData = payload.data?.series || [];
  let dataFrames = getProcessedData({ withTransforms: true, withFieldConfig: true }, preData, payload.panel);

  const transformer = {
    id: DataTransformerID.joinByField,
    options: { byField: undefined }, // defaults to time field
  };

  if (dataFrames.length > 1) {
    transformDataFrame([transformer], dataFrames).subscribe((data) => {
      dataFrames = data; //, () => sub.unsubscribe();
    });
  }

  switch (payload.format) {
    case ExportType.jpeg:
    case ExportType.png:
    case ExportType.bmp:
      exportImage(payload);
      break;
    case ExportType.csv:
      downloadDataFrameAsCsv(dataFrames[0], payload.panel.title);
      break;
    case ExportType.xlsx:
      exportExcel(dataFrames[0], payload.panel.title);
      break;
    case ExportType.panelJson:
      exportPanelJSON(payload.panel.getSaveModel(), payload.panel.title);
      console.log(payload.panel.getSaveModel());
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

export async function exportImage(payload: ExportPayload) {
  let mockHTMLElement = document.createElement('a');
  //const mockHTMLChildElement = document.createElement("div");
  //mockHTMLElement = mockHTMLElement.appendChild(mockHTMLChildElement);

  console.log(mockHTMLElement);
  // console.log(await toCanvas(mockHTMLElement, { style: { transform: 'translate(0px, 0px)' } }))

  // NOT WORKING FOR NEWS, GEOMAP, LOGS - new maybe due to nested images? geomap operation is insecure
  /*const panelCanvas:HTMLCanvasElement = await toCanvas(payload.htmlElement, { style: { transform: 'translate(0px, 0px)' } });

  const fileName = `${payload.panel.title}-${dateTimeFormat(new Date())}.${payload.format}`;
  let a = document.createElement('canvas');
  //a = await toCanvas(payload.htmlElement ?? new Node(), { style: { transform: 'translate(0px, 0px)' } });

  console.log("pc", panelCanvas as HTMLCanvasElement, a);
  //a.toBlob((blob) => { saveAs(blob as Blob, fileName) }, `image/${payload.format}`);
  (panelCanvas as HTMLCanvasElement).toBlob((blob) => { saveAs(blob as Blob, fileName) }, `image/${payload.format}`);  */

  // HTML2CANVAS
  /*const fileName = `${payload.panel.title}-${dateTimeFormat(new Date())}.${payload.format}`; // CONSOLE LOGS A LOT
  const panelCanvas = await html2canvas(payload.htmlElement);
  panelCanvas.toBlob((blob) => { saveAs(blob as Blob, fileName) }, `image/${payload.format}`); */

  // HTML-TO-IMAGE
  const fileName = `${payload.panel.title}-${dateTimeFormat(new Date())}.${payload.format}`;
  const panelCanvas = await toCanvas(payload.htmlElement ?? new Node(), {
    style: { transform: 'translate(0px, 0px)' },
  });
  panelCanvas.toBlob((blob) => {
    saveAs(blob ?? new Blob(), fileName);
  }, `image/${payload.format}`);

  // DOM-TO-IMAGE
  /*const fileName = `${payload.panel.title}-${dateTimeFormat(new Date())}.${payload.format}`; 
  let panelBlob = await domtoimage.toBlob(payload.htmlElement);
  panelBlob = panelBlob.slice(0, panelBlob.size, `image/${payload.format}`)
  saveAs(panelBlob, fileName); */
}
