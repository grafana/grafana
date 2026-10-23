import { useCallback } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type SceneDataLayerProvider, type SceneObject, useSceneObjectState } from '@grafana/scenes';

import { type DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { annotationEditActions } from '../settings/annotations/actions';

import { SidebarAddButton } from './dashboard/SidebarAddButton';

export function useSectionAnnotationLayers(sectionOwner: SceneObject): SceneDataLayerProvider[] {
  const { $data } = useSceneObjectState(sectionOwner, { shouldActivateOrKeepAlive: true });
  const dataLayerSet = $data instanceof DashboardDataLayerSet ? $data : undefined;
  const setState = useSceneObjectState(dataLayerSet ?? sectionOwner, { shouldActivateOrKeepAlive: true });

  if (!dataLayerSet) {
    return [];
  }

  if ('annotationLayers' in setState && Array.isArray(setState.annotationLayers)) {
    return setState.annotationLayers;
  }

  return dataLayerSet.state.annotationLayers;
}

export function AddSectionAnnotationButton({ sectionOwner }: { sectionOwner: SceneObject }) {
  const onAdd = useCallback(() => {
    void addSectionAnnotation(sectionOwner);
  }, [sectionOwner]);

  return (
    <SidebarAddButton
      onAdd={onAdd}
      tooltip={t('dashboard.sidebar.annotations.add-annotation-query', 'Add annotation query')}
      dataTestId={selectors.components.PanelEditor.ElementEditPane.addAnnotationButton}
    />
  );
}

export async function addSectionAnnotation(sectionOwner: SceneObject): Promise<DashboardAnnotationsDataLayer> {
  const current = sectionOwner.state.$data;
  const dataLayerSet =
    current instanceof DashboardDataLayerSet ? current : new DashboardDataLayerSet({ annotationLayers: [] });

  if (!(current instanceof DashboardDataLayerSet)) {
    sectionOwner.setState({ $data: dataLayerSet });
  }

  const addedObject = await dataLayerSet.createDefaultAnnotationLayer();
  annotationEditActions.addAnnotation({ source: dataLayerSet, addedObject });
  return addedObject;
}
