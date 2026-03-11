import { sceneGraph, SceneObject } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

export function verifyDrilldownApplicability(
  sourceObject: SceneObject,
  queriesDataSource: DataSourceRef | null | undefined,
  drilldownDatasource: DataSourceRef | null,
  isApplicabilityEnabled?: boolean
): boolean {
  const datasourceUid = sceneGraph.interpolate(sourceObject, queriesDataSource?.uid);
  const applicabilityEnabled = isApplicabilityEnabled !== false;

  return Boolean(applicabilityEnabled && datasourceUid === sceneGraph.interpolate(sourceObject, drilldownDatasource?.uid));
}
