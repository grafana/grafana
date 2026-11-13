import { type SceneObject } from '@grafana/scenes';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { getTopPlacementLabel } from '../utils/getTopPlacementLabel';

import { useSectionAnnotationLayers } from './SectionAnnotationActions';
import { DashboardAnnotationsList } from './dashboard/DashboardAnnotationsList';

export function SectionAnnotationsList({ sectionOwner }: { sectionOwner: SceneObject }) {
  const layers = useSectionAnnotationLayers(sectionOwner);
  const dataLayerSet = sectionOwner.state.$data;

  if (!(dataLayerSet instanceof DashboardDataLayerSet) || layers.length === 0) {
    return null;
  }

  return (
    <DashboardAnnotationsList
      dataLayerSet={dataLayerSet}
      visibleTitle={getTopPlacementLabel(sectionOwner)}
      hideControlsMenuList
    />
  );
}
