import { type PanelData } from '@grafana/data';
import { type SceneDataProvider } from '@grafana/scenes';

import { getSourceDataProvider } from '../../utils/getSourceDataProvider';

/**
 * The pre-transformation query result. Snapshots store it alongside the panel's transformations,
 * so transformed frames here would run them a second time on open.
 */
export function getSnapshotSourceData(dataProvider: SceneDataProvider): PanelData | undefined {
  return getSourceDataProvider(dataProvider)?.state.data;
}
