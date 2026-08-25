import { getDefaultTimeRange, LoadingState, type PanelData, toDataFrame } from '@grafana/data';
import { SceneDataNode, SceneDataTransformer } from '@grafana/scenes';

import { getSnapshotSourceData } from './snapshotData';

function panelData(frameName: string): PanelData {
  return {
    state: LoadingState.Done,
    series: [toDataFrame({ name: frameName, fields: [] })],
    timeRange: getDefaultTimeRange(),
  };
}

describe('getSnapshotSourceData', () => {
  it('reads a provider that is not a transformer directly', () => {
    const queryResult = new SceneDataNode({ data: panelData('raw') });

    expect(getSnapshotSourceData(queryResult)?.series[0].name).toBe('raw');
  });

  it('reads a transformer’s source rather than its own output', () => {
    const queryResult = new SceneDataNode({ data: panelData('raw') });
    const transformer = new SceneDataTransformer({ $data: queryResult, transformations: [] });
    transformer.setState({ data: panelData('transformed') });

    expect(getSnapshotSourceData(transformer)?.series[0].name).toBe('raw');
  });

  it('returns nothing for a transformer with no source, rather than its transformed output', () => {
    const transformer = new SceneDataTransformer({ transformations: [] });
    transformer.setState({ data: panelData('transformed') });

    // A snapshot is written alongside the panel's transformations, so transformed frames here would
    // run them a second time on open. No frames is recoverable; silently wrong frames is not.
    expect(getSnapshotSourceData(transformer)).toBeUndefined();
  });
});
