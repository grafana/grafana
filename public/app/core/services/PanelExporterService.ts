import domtoimage from 'dom-to-image';

import { CSVConfig, DataFrame, DataTransformerID } from '@grafana/data';
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
  const dataFrames = e.data?.series || [];
  switch (e.format) {
    case ExportType.jpeg:
    case ExportType.png:
    case ExportType.bmp:
      exportImage(e); // works with jpeg but not jpg
      break;
    case ExportType.csv:
      downloadDataFrameAsCsv(dataFrames[0], 'hi'); //FIGURE OUT INDEX
      break;
    case ExportType.xls:
      console.log('xls');
      break;
    case ExportType.numbers:
      console.log('numbers');
      break;
    case ExportType.json:
      downloadAsJson(dataFrames, 'howdy');
      downloadTraceAsJson(dataFrames[0], 'woah');
    default:
      console.log('default');
      break;
  }
}

async function exportImage(e: ExportPanelPayload) {
  console.log('exportPNG', e);
  //todo avoid as     DONE?
  const canvas = e.htmlElement;

  const b = await domtoimage.toBlob(e.parentHtml ?? new Node());
  console.log('b', b);

  //TODO FIX
  const link = document.createElement('a');
  link.download = 'asdasd.' + e.format; // Do we want custom names or nah?
  canvas.toBlob((blob) => {
    link.href = URL.createObjectURL(blob!);
    link.click();
    URL.revokeObjectURL(link.href);
  }, 'image/' + e.format);

  const link2 = document.createElement('a');
  link2.download = 'bobobo.' + e.format;
  link2.href = URL.createObjectURL(b);
  link2.click();
  URL.revokeObjectURL(link2.href);
}

export function exportStartup(e: PanelExportEvent) {
  // right now holding no type
  //appEvents.subscribe(PanelExportEvent, (e) => {
  //const { data, isLoading, error } = usePanelLatestData(e.payload.panel, dataOptions, true); // this is a hook
  console.log('the e', e);
  // console.log(data, isLoading, error)
  // this.exportSelector(e.payload);
  exportSelect(e.payload);
  // }); // Binds PanelExportEvent to exportPNG method
}

/* function getProcessedData(e:ExportPanelPayload): DataFrame[] {
  // const { options, panel, timeZone } = this.props;
  //const data = this.state.transformedData;

  if (!e.panel) {
    return applyRawFieldOverrides(e.data);
  }

  const fieldConfig = this.cleanTableConfigFromFieldConfig(e.panel.type, e.panel.fieldConfig);

  // We need to apply field config as it's not done by PanelQueryRunner (even when withFieldConfig is true).
  // It's because transformers create new fields and data frames, and we need to clean field config of any table settings.
  return applyFieldOverrides({
    data,
    theme: config.theme2,
    fieldConfig,
    timeZone,
    replaceVariables: (value: string) => {
      return value;
    },
  });
} */

export class PanelExporterService {
  init() {}

  exportSelector(e: ExportPanelPayload) {}

  /*exportPNG(e: ExportPanelPayload) {
    console.log('exportPNG', e);
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

  exportCsv = (dataFrame: DataFrame, csvConfig: CSVConfig = {}) => {
    // const { panel } = this.props;
    const transformId = DataTransformerID.noop;

    downloadDataFrameAsCsv(dataFrame, 'OHNO', csvConfig, transformId);
  }; // FROM InspectDataTab.tsx
  // [ download.ts ALSO HAS DownloadAsJson() ]
}
