import saveAs from 'file-saver';
import { toJpeg, toPng } from 'html-to-image';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

import {
  DataFrame,
  DataTransformerID,
  dateTimeFormat,
  formattedValueToString,
  PanelData,
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
      exportJSON(payload.panel.getSaveModel(), payload.panel.title);
      break;
    case ExportType.dataJson:
      exportJSON(payload.data, payload.panel.title);
      break;
    case ExportType.dataFrameJson:
      const panelData = await firstValueFrom(
        payload.panel.getQueryRunner().getData({
          withFieldConfig: false,
          withTransforms: false,
        })
      );
      exportJSON(panelData, payload.panel.title);
      break;
  }
}

function exportJSON(panelData: PanelData | null | undefined, title: string) {
  let blob: Blob;

  if (panelData?.series) {
    let jsonData = getPanelDataFrames(panelData);
    blob = new Blob([getPrettyJSON(jsonData)], {
      type: 'application/json',
    });
  } else {
    blob = new Blob([getPrettyJSON(panelData)], {
      type: 'application/json',
    });
  }

  const fileName = `${title}-${dateTimeFormat(new Date())}.json`;
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

  let dataSheet = XLSX.utils.json_to_sheet(dataJson);
  let xlsxFile = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(xlsxFile, dataSheet, 'People');
  const fileName = `${title}-${dateTimeFormat(new Date())}.xlsx`;
  XLSX.writeFile(xlsxFile, fileName);
}

async function exportImage(payload: ExportPayload) {
  // NOT WORKING FOR NEWS OR GEOMAP - new maybe due to nested images. geomap operation is insecure
  let c = '';
  if (payload.format === ExportType.png) {
    c = await toPng(payload.htmlElement ?? new Node(), { style: { transform: 'translate(0px, 0px)' } });
  } else if (payload.format === ExportType.jpeg) {
    c = await toJpeg(payload.htmlElement ?? new Node(), { style: { transform: 'translate(0px, 0px)' } });
  } // cant get it to work with custom formats in toBlob?
  const fileName = `${payload.panel.title}-${dateTimeFormat(new Date())}.${payload.format}`;

  saveAs(c, fileName);
}
