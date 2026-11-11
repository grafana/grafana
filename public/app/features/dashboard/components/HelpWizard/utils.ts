import { type PanelData, type DataFrameJSON, dataFrameToJSON, DataTopic } from '@grafana/data';

export function getPanelDataFrames(data?: PanelData): DataFrameJSON[] {
  const frames: DataFrameJSON[] = [];
  if (data?.series) {
    for (const f of data.series) {
      frames.push(dataFrameToJSON(f));
    }
  }
  if (data?.annotations) {
    for (const f of data.annotations) {
      const json = dataFrameToJSON(f);
      if (!json.schema?.meta) {
        json.schema!.meta = {};
      }
      json.schema!.meta.dataTopic = DataTopic.Annotations;
      frames.push(json);
    }
  }
  return frames;
}
