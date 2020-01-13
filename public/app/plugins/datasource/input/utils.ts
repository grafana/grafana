import { DataFrameDTO, toCSV } from '@grafana/data';
import { toDataFrame } from '@grafana/data/src/dataframe';

export function dataFrameToCSV(dto?: DataFrameDTO[]) {
  if (!dto || !dto.length) {
    return '';
  }
  return toCSV(dto.map(v => toDataFrame(v)));
}
