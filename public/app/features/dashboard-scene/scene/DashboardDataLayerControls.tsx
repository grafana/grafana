import { css } from '@emotion/css';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { type SceneDataLayerProvider, sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { annotationEditActions } from '../settings/annotations/actions';
import { getRepeatSourceObject } from '../utils/clone';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet, isDashboardDataLayerSet, isDashboardDataLayerSetState } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';
import { DataLayerControl } from './DataLayerControl';
import { AnnotationEditActions } from './edit-actions-popover/AnnotationEditActions';
import { EditActionsPopover } from './edit-actions-popover/EditActionsPopover';

// The annotation query editor pulls in the standard annotation editor and data source
// picker, so it is loaded on demand when the user opens the query editor.
const AnnotationQueryEditorModal = lazy(() =>
  import(/* webpackChunkName: "dashboard-edit-actions" */ '../settings/annotations/AnnotationQueryEditorModal').then(
    (m) => ({ default: m.AnnotationQueryEditorModal })
  )
);

type DashboardDataLayerControlsProps = {
  dashboard: DashboardScene;
  inMenu?: boolean;
  // Section sets whose controls are shown after the dashboard layers, e.g. for the panel in panel edit or view panel
  sectionDataLayerSets?: DashboardDataLayerSet[];
};

export function DashboardDataLayerControls({
  dashboard,
  inMenu,
  sectionDataLayerSets,
}: DashboardDataLayerControlsProps) {
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

  const dashboardControls = useMemo(
    () =>
      visibleLayers.map((layer) => (
        <DataLayerControlEditWrapper key={layer.state.key!} layer={layer} inMenu={inMenu} />
      )),
    [inMenu, visibleLayers]
  );

  return (
    <>
      {dashboardControls}
      {sectionDataLayerSets?.map((set) => (
        <SectionDataLayerControls key={set.state.key} dataLayerSet={set} inMenu={inMenu} />
      ))}
    </>
  );
}

// Subscribes to the section set so adding, removing or duplicating its layers updates the controls
function SectionDataLayerControls({ dataLayerSet, inMenu }: { dataLayerSet: DashboardDataLayerSet; inMenu?: boolean }) {
  const { annotationLayers } = dataLayerSet.useState();

  return annotationLayers
    .filter((layer) => !layer.state.isHidden)
    .map((layer) => <DataLayerControlEditWrapper key={layer.state.key!} layer={layer} inMenu={inMenu} />);
}

export function DataLayerControlEditWrapper({ layer, inMenu }: { layer: SceneDataLayerProvider; inMenu?: boolean }) {
  const styles = useStyles2(getStyles);
  const [isQueryEditorOpen, setIsQueryEditorOpen] = useState(false);
  // Controls in a repeated row/tab render clone layers; edit the source so every repeat picks up the change
  const sourceLayer = useMemo(() => getRepeatSourceObject(layer), [layer]);

  const onClickEditLayer = useCallback(() => {
    const dashboard = sceneGraph.getAncestor(sourceLayer, DashboardScene);
    dashboard.state.sidebar.selectObject(sourceLayer);
  }, [sourceLayer]);

  const onClickEditLayerQuery = useCallback(() => {
    // Query editors suggest variables from the sidebar selection, so select the layer to scope them to its section
    const dashboard = sceneGraph.getAncestor(sourceLayer, DashboardScene);
    dashboard.state.sidebar.selectObject(sourceLayer);
    setIsQueryEditorOpen(true);
  }, [sourceLayer]);

  const onClickDuplicateLayer = useCallback(() => {
    if (sourceLayer instanceof DashboardAnnotationsDataLayer) {
      annotationEditActions.duplicateAnnotation(sourceLayer);
    }
  }, [sourceLayer]);

  const onClickDeleteLayer = useCallback(() => {
    const dataLayerSet = sourceLayer.parent;

    if (dataLayerSet instanceof DashboardDataLayerSet && sourceLayer instanceof DashboardAnnotationsDataLayer) {
      annotationEditActions.removeAnnotation({
        source: dataLayerSet,
        removedObject: sourceLayer,
      });
    }
  }, [sourceLayer]);

  const editActions = useMemo(
    () => (
      <AnnotationEditActions
        layer={sourceLayer}
        onClickEdit={onClickEditLayer}
        onClickEditQuery={onClickEditLayerQuery}
        onClickDuplicate={onClickDuplicateLayer}
        onClickDelete={onClickDeleteLayer}
      />
    ),
    [sourceLayer, onClickEditLayer, onClickEditLayerQuery, onClickDuplicateLayer, onClickDeleteLayer]
  );

  return (
    <>
      {isQueryEditorOpen && sourceLayer instanceof DashboardAnnotationsDataLayer && (
        <Suspense fallback={null}>
          <AnnotationQueryEditorModal layer={sourceLayer} onClose={() => setIsQueryEditorOpen(false)} />
        </Suspense>
      )}
      <EditActionsPopover content={editActions}>
        <div className={styles.container}>
          <DataLayerControl layer={layer} inMenu={inMenu} />
        </div>
      </EditActionsPopover>
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
