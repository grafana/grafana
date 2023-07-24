import saveAs from 'file-saver';
import { toBlob, toCanvas, toJpeg, toPng } from 'html-to-image';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

import { DataFrame, dateTimeFormat, formattedValueToString } from '@grafana/data';
import { getPanelDataFrames } from 'app/features/dashboard/components/HelpWizard/utils';
import { getProcessedData } from 'app/features/inspector/InspectDataTab';
import { getPrettyJSON } from 'app/features/inspector/InspectJSONTab';
import { downloadDataFrameAsCsv } from 'app/features/inspector/utils/download';
//import { downloadAsJson, downloadDataFrameAsCsv, downloadTraceAsJson } from 'app/features/inspector/utils/download';

import { ExportPanelPayload, PanelExportEvent } from '../../types/events';

export enum ExportType {
  jpeg = 'jpeg',
  png = 'png',
  bmp = 'bmp',
  csv = 'csv',
  xlsx = 'xlsx',
  numbers = 'numbers',
  panelJson = 'panelJson',
  dataJson = 'dataJson',
  dataFrameJson = 'dataFrameJson',
}

export function exportSelect(e: PanelExportEvent) {
  const payload = e.payload;
  const preData = payload.data?.series || [];
  const dataFrames = getProcessedData({ withTransforms: true, withFieldConfig: true }, preData, payload.panel);
  console.log('exportData', dataFrames[0]);

  switch (
    payload.format // WE NEED TO REMOVE OPTIONS FOR PANELS WITHOUT DATA AND SUCH
  ) {
    case ExportType.jpeg:
    case ExportType.png:
    case ExportType.bmp: // maybe remove?
      exportImage(payload);
      break;
    case ExportType.csv:
      downloadDataFrameAsCsv(dataFrames[0], payload.panel.title); //FIGURE OUT INDEX - should just be 0 because with transforms applied it's only 1
      break;
    case ExportType.xlsx:
      exportExcel(dataFrames[0], payload.panel.title);
      break;
    case ExportType.panelJson: // Panel JSON, Panel Data, DataFrame JSON (from Query)
    case ExportType.dataJson:
    case ExportType.dataFrameJson:
      exportJSON(payload);
      break;
    default:
      console.log('AAAA default');
      break;
  }
}

async function exportJSON(payload: ExportPanelPayload) {
  let d;
  if (payload.format === ExportType.panelJson) {
    // replace with case?
    d = payload.panel.getSaveModel();
  } else if (payload.format === ExportType.dataJson) {
    d = payload.data;
  } else if (payload.format === ExportType.dataFrameJson) {
    d = await firstValueFrom(
      payload.panel.getQueryRunner().getData({
        withFieldConfig: false,
        withTransforms: false,
      })
    );
    d = getPanelDataFrames(d);
  }

  const blob = new Blob([getPrettyJSON(d)], {
    // THIS IS EXACTLY PANEL JSON
    type: 'application/json',
  });

  const fileName = `${payload.panel.title}-${dateTimeFormat(new Date())}.json`;
  saveAs(blob, fileName);
}

function exportExcel(data: DataFrame, title: string) {
  let dataJson = [];

  for (let i = 0; i < data.fields[0].values.length; i++) {
    let dataField: Record<string, string> = {};
    for (let j = 0; j < data.fields.length; j++) {
      const formattedValue = data.fields[j].display!(data.fields[j].values[i]);
      dataField[data.fields[j].name] = formattedValueToString(formattedValue);
    }
    dataJson.push(dataField);
  }

  let dataSheet = XLSX.utils.json_to_sheet(dataJson); // we will need to convert time types and such still DONE
  let xlsxFile = XLSX.utils.book_new(); // datframe[0] ISNT suitable for pie charts seamingly (and myabe others)
  XLSX.utils.book_append_sheet(xlsxFile, dataSheet, 'People');
  title = title + '_temp.xlsx';
  XLSX.writeFile(xlsxFile, title);
}

async function exportImage(payload: ExportPanelPayload) {
  // NOT WORKING FOR NEWS OR GEOMAP - new maybe due to nested images. geomap operation is insecure
  let c = '';
  if (payload.format === ExportType.png) {
    c = await toPng(payload.htmlElement ?? new Node(), { style: { transform: 'translate(0px, 0px)' } });
  } else if (payload.format === ExportType.jpeg) {
    c = await toJpeg(payload.htmlElement ?? new Node(), { style: { transform: 'translate(0px, 0px)' } });
  } // cant get it to work with custom formats in toBlob?
  const fileName = payload.panel.title + '_imageTest.' + payload.format;

  saveAs(c, fileName);
}
