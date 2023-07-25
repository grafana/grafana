import { PanelData } from '@grafana/data';
import { PanelModel } from 'app/features/dashboard/state';

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

export interface ExportPayload {
  panel: PanelModel;
  htmlElement: HTMLElement;
  format: ExportType;
  data?: PanelData | null;
}
