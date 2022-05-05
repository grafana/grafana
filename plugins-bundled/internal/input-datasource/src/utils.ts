import { toDataFrame, DataFrameDTO, toCSV } from '@grafana/data';

export function dataFrameToCSV(dto?: DataFrameDTO[]) {
  if (!dto || !dto.length) {
    return '';
  }
  return toCSV(dto.map((v) => toDataFrame(v)));
}
