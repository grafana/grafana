import { type DataFrame } from '@grafana/data/dataframe';

export interface FileImportResult {
  dataFrames: DataFrame[];
  file: File;
}
