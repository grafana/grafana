import { sceneGraph, SceneObject } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

export function verifyDrilldownApplicability(
  sourceObject: SceneObject,
  queriesDataSource: DataSourceRef | null | undefined,
  drilldownDatasource: DataSourceRef | null,
  isApplicabilityEnabled?: boolean
): boolean {
  const datasourceUid = sceneGraph.interpolate(sourceObject, queriesDataSource?.uid);

  return Boolean(
    isApplicabilityEnabled && datasourceUid === sceneGraph.interpolate(sourceObject, drilldownDatasource?.uid)
  );
}
