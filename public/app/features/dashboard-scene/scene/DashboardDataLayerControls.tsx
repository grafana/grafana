import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { type SceneDataLayerProvider, sceneGraph } from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

import { AnnotationEditableElement } from '../settings/annotations/AnnotationEditableElement';
import { AnnotationQueryEditorModal } from '../settings/annotations/AnnotationQueryEditorModal';
import { annotationEditActions } from '../settings/annotations/actions';

import { AnnotationEditActions, ControlActionsPopover } from './ControlActionsPopover';
import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet, isDashboardDataLayerSet, isDashboardDataLayerSetState } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';
import { DataLayerControl } from './DataLayerControl';

type DashboardDataLayerControlsProps = {
  dashboard: DashboardScene;
  inMenu?: boolean;
};

export function DashboardDataLayerControls({ dashboard, inMenu }: DashboardDataLayerControlsProps) {
  // We render controls here (instead of the data layer set's default renderer) to
  // respect per-layer `placement` and edit-mode visibility rules.
  const dataLayerSet = sceneGraph.getData(dashboard);
  const state = dataLayerSet.useState();

  const visibleLayers = useMemo(() => {
    if (!isDashboardDataLayerSetState(state) || !isDashboardDataLayerSet(dataLayerSet)) {
      return [];
    }
    return state.annotationLayers.filter((layer) => !layer.state.isHidden && layer.state.placement === undefined);
  }, [state, dataLayerSet]);

  return useMemo(
    () =>
      visibleLayers.map((layer) => (
        <DataLayerControlEditWrapper key={layer.state.key!} layer={layer} inMenu={inMenu} />
      )),
    [inMenu, visibleLayers]
  );
}

export function DataLayerControlEditWrapper({ layer, inMenu }: { layer: SceneDataLayerProvider; inMenu?: boolean }) {
  const styles = useStyles2(getStyles);
  const { isSelectable } = useElementSelection(layer.state.key);
  const [isQueryEditorOpen, setIsQueryEditorOpen] = useState(false);

  const onClickEditLayer = useCallback(() => {
    const dashboard = sceneGraph.getAncestor(layer, DashboardScene);
    dashboard.state.sidebar.selectObject(layer);
  }, [layer]);

  const onClickEditLayerQuery = useCallback(() => {
    setIsQueryEditorOpen(true);
  }, []);

  const onClickDuplicateLayer = useCallback(() => {
    if (layer instanceof DashboardAnnotationsDataLayer) {
      new AnnotationEditableElement(layer).onDuplicate();
    }
  }, [layer]);

  const onClickDeleteLayer = useCallback(() => {
    const dataLayerSet = layer.parent;

    if (dataLayerSet instanceof DashboardDataLayerSet && layer instanceof DashboardAnnotationsDataLayer) {
      annotationEditActions.removeAnnotation({
        source: dataLayerSet,
        removedObject: layer,
      });
    }
  }, [layer]);

  const editActions = useMemo(
    () => (
      <AnnotationEditActions
        layer={layer}
        onClickEdit={onClickEditLayer}
        onClickEditQuery={onClickEditLayerQuery}
        onClickDuplicate={onClickDuplicateLayer}
        onClickDelete={onClickDeleteLayer}
      />
    ),
    [layer, onClickEditLayer, onClickEditLayerQuery, onClickDuplicateLayer, onClickDeleteLayer]
  );

  return (
    <>
      {isQueryEditorOpen && layer instanceof DashboardAnnotationsDataLayer && (
        <AnnotationQueryEditorModal layer={layer} onClose={() => setIsQueryEditorOpen(false)} />
      )}
      <ControlActionsPopover isEditable={Boolean(isSelectable)} content={editActions}>
        <div className={styles.container}>
          <DataLayerControl layer={layer} inMenu={inMenu} />
        </div>
      </ControlActionsPopover>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    label: 'dashboard-data-layer-controls',
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
});
