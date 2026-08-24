import { type PanelData } from '@grafana/data';
import { type SceneDataProvider, SceneDataTransformer } from '@grafana/scenes';

/**
 * The data a snapshot captures for a panel: the query result, before anything transformed it. Both
 * the v1 and v2 serializers write it into a `GrafanaQueryType.Snapshot` query alongside the panel's
 * transformations — so capturing transformed frames here would make opening the snapshot run them a
 * second time, over data they had already been applied to.
 *
 * A transformer holds its own output in `state.data`, which makes it the one provider that cannot be
 * read directly. It carries its source in `$data`; a transformer without one resolves through the
 * scene graph instead, but that shape cannot reach a serializer — `getQueryRunnerFor` recurses
 * forever on it — so the snapshot gets no frames rather than the transformed ones.
 */
export function getSnapshotSourceData(dataProvider: SceneDataProvider): PanelData | undefined {
  const source = dataProvider instanceof SceneDataTransformer ? dataProvider.state.$data : dataProvider;

  return source?.state.data;
}
