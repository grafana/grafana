import { DataFrame } from '@grafana/data';

export interface FileImportResult {
  dataFrames: DataFrame[];
  file: File;
}
