import { useCallback } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type SceneDataLayerProvider, type SceneObject, useSceneObjectState } from '@grafana/scenes';
import { Button, Stack } from '@grafana/ui';

import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { annotationEditActions } from '../settings/annotations/actions';

import { SidebarAddButton } from './dashboard/SidebarAddButton';
import { selectSidebarObject } from './dashboard/helpers';

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

export function SectionAnnotationsList({ sectionOwner }: { sectionOwner: SceneObject }) {
  const layers = useSectionAnnotationLayers(sectionOwner).filter(
    (layer): layer is DashboardAnnotationsDataLayer => layer instanceof DashboardAnnotationsDataLayer
  );

  if (layers.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={0.5}>
      {layers.map((layer) => (
        <Button
          key={layer.state.key}
          variant="secondary"
          fill="text"
          size="sm"
          onClick={() => selectSidebarObject(layer)}
          data-testid={`section-annotation-${layer.state.name}`}
        >
          {layer.state.name}
        </Button>
      ))}
    </Stack>
  );
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
  let dataLayerSet = sectionOwner.state.$data;
  if (!(dataLayerSet instanceof DashboardDataLayerSet)) {
    dataLayerSet = new DashboardDataLayerSet({ annotationLayers: [] });
    sectionOwner.setState({ $data: dataLayerSet });
  }

  const addedObject = await dataLayerSet.createDefaultAnnotationLayer();
  annotationEditActions.addAnnotation({ source: dataLayerSet, addedObject });
  return addedObject;
}
