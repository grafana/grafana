import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { type DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { annotationEditActions } from '../../settings/annotations/actions';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { addSectionAnnotation } from '../SectionAnnotationsList';

import { AddButton } from './AddButton';

export const useBuildAddAnnotation = (dataLayers: DashboardDataLayerSet) =>
  useCallback(async () => {
    const newAnnotation = await dataLayers.createDefaultAnnotationLayer();
    annotationEditActions.addAnnotation({
      source: dataLayers,
      addedObject: newAnnotation,
    });
  }, [dataLayers]);

export function AddAnnotationQuery({
  dashboardScene,
  selectedElement,
}: {
  dashboardScene: DashboardSceneLike;
  selectedElement?: SceneObject;
}) {
  const onAddDashboardAnnotation = useBuildAddAnnotation(dashboardSceneGraph.getDataLayers(dashboardScene));
  const onAddAnnotationClick = useCallback(() => {
    const sectionOwner = dashboardSceneGraph.findSectionOwner(selectedElement);
    if (sectionOwner) {
      void addSectionAnnotation(sectionOwner);
      return;
    }

    void onAddDashboardAnnotation();
  }, [onAddDashboardAnnotation, selectedElement]);

  return (
    <AddButton
      icon="comment-alt"
      label={t('dashboard.sidebar.add.annotation-query.label', 'Annotation query')}
      tooltip={t('dashboard.sidebar.add.annotation-query.description', 'Add event data to graphs')}
      onClick={onAddAnnotationClick}
    />
  );
}
