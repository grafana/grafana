import { useCallback } from 'react';

import { t } from '@grafana/i18n';

import { type DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { annotationEditActions } from '../../settings/annotations/actions';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';

import { AddButton } from './AddButton';

export const useBuildAddAnnotation = (dataLayers: DashboardDataLayerSet) =>
  useCallback(() => {
    const newAnnotation = dataLayers.createDefaultAnnotationLayer();
    annotationEditActions.addAnnotation({
      source: dataLayers,
      addedObject: newAnnotation,
    });
  }, [dataLayers]);

export function AddAnnotationQuery({ dashboardScene }: { dashboardScene: DashboardSceneLike }) {
  const onAddAnnotationClick = useBuildAddAnnotation(dashboardSceneGraph.getDataLayers(dashboardScene));

  return (
    <AddButton
      icon="comment-alt"
      label={t('dashboard-scene.annotation-control.label-annotation-query', 'Annotation query')}
      tooltip={t('dashboard-scene.annotation-control.description-add-event-data-to-graphs', 'Add event data to graphs')}
      onClick={onAddAnnotationClick}
    />
  );
}
