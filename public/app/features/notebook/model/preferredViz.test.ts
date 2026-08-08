import { FieldType, LoadingState, getDefaultTimeRange, toDataFrame, type PanelData } from '@grafana/data';

import { preferredVizForData } from './preferredViz';

function dataWith(frames: Array<ReturnType<typeof toDataFrame>>): PanelData {
  return { state: LoadingState.Done, series: frames, timeRange: getDefaultTimeRange() };
}

describe('preferredVizForData', () => {
  it('uses an explicit preferred plugin id from frame meta first', () => {
    const frame = toDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [1] }] });
    frame.meta = { preferredVisualisationPluginId: 'nodeGraph', preferredVisualisationType: 'logs' };
    expect(preferredVizForData(dataWith([frame]))).toBe('nodeGraph');
  });

  it('maps preferred visualisation types to panel plugins', () => {
    const frame = toDataFrame({ fields: [{ name: 'line', type: FieldType.string, values: ['a'] }] });
    frame.meta = { preferredVisualisationType: 'logs' };
    expect(preferredVizForData(dataWith([frame]))).toBe('logs');
  });

  it('detects time series shapes and falls back to table otherwise', () => {
    const timeSeries = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'value', type: FieldType.number, values: [1, 2] },
      ],
    });
    expect(preferredVizForData(dataWith([timeSeries]))).toBe('timeseries');

    const tabular = toDataFrame({
      fields: [
        { name: 'name', type: FieldType.string, values: ['a'] },
        { name: 'count', type: FieldType.number, values: [1] },
      ],
    });
    expect(preferredVizForData(dataWith([tabular]))).toBe('table');
  });
});
