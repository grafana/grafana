import domtoimage from 'dom-to-image';

import { getProcessedData } from 'app/features/inspector/InspectDataTab';
import { downloadAsJson, downloadDataFrameAsCsv, downloadTraceAsJson } from 'app/features/inspector/utils/download';

import { ExportPanelPayload, PanelExportEvent } from '../../types/events';

export enum ExportType {
  jpeg = 'jpeg',
  png = 'png',
  bmp = 'bmp',
  csv = 'csv',
  xls = 'xls',
  numbers = 'numbers',
  json = 'json',
}

function exportSelect(e: ExportPanelPayload) {
  console.log('zone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  const preData = e.data?.series || [];
  const dataFrames = getProcessedData({ withTransforms: true, withFieldConfig: true }, preData, e.panel);
  console.log('exportData', dataFrames[0]);
  switch (e.format) {
    case ExportType.jpeg:
    case ExportType.png:
    case ExportType.bmp:
      exportImage(e); // works with jpeg but not jpg
      break;
    case ExportType.csv:
      downloadDataFrameAsCsv(dataFrames[0], e.panel.title); //FIGURE OUT INDEX - should just be 0 because with transforms applied it's only 1
      break;
    case ExportType.xls:
      downloadDataFrameAsCsv(dataFrames[0], e.panel.title, { useExcelHeader: true }); // how does Inspect do xls? SEEMINGLY just add    sep=,     at the front
      break;
    case ExportType.numbers:
      downloadDataFrameAsCsv(dataFrames[0], e.panel.title); // seems to
      break;
    case ExportType.json: // Panel JSON, Panel Data, DataFrame JSON (from Query)
      downloadAsJson(dataFrames[0], e.panel.title);
      downloadTraceAsJson(dataFrames[0], e.panel.title);
    default:
      console.log('default');
      break;
  }
}

async function exportImage(e: ExportPanelPayload) {
  //todo avoid as     DONE?
  const canvas = e.htmlElement;

  const b = await domtoimage.toBlob(e.parentHtml ?? new Node()); //html-to-image instead?!?
  console.log('b', b);

  const link = document.createElement('a');
  link.download = e.panel.title + '.' + e.format;
  canvas.toBlob((blob) => {
    link.href = URL.createObjectURL(blob!);
    link.click();
    URL.revokeObjectURL(link.href);
  }, 'image/' + e.format);

  const link2 = document.createElement('a');
  link2.download = e.panel.title + '_B.' + e.format;
  link2.href = URL.createObjectURL(b);
  link2.click();
  URL.revokeObjectURL(link2.href);
}

export function exportStartup(e: PanelExportEvent) {
  // right now holding no type
  //appEvents.subscribe(PanelExportEvent, (e) => {
  exportSelect(e.payload);
}

export class PanelExporterService {
  init() {}

  exportSelector(e: ExportPanelPayload) {}

  /*exportPNG(e: ExportPanelPayload) {
    //todo avoid as     DONE?
    const canvas = e.htmlElement;

    //TODO FIX
    const link = document.createElement('a');
    link.download = 'asdasd.png'; // Do we want custom names or nah?
    canvas.toBlob((blob) => {
      link.href = URL.createObjectURL(blob!);
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  } */
  // [ download.ts ALSO HAS DownloadAsJson() ]
}
