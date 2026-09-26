import { css } from '@emotion/css';
import { lazy, Suspense } from 'react';

import {
  type SceneComponentProps,
  SceneObjectBase,
  sceneGraph,
  type SceneObjectRef,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { Modal, Spinner, useStyles2 } from '@grafana/ui';
import { getDashboardSceneFor, getLibraryPanelBehavior } from 'app/features/dashboard-scene/utils/utils';

import { NOTEBOOK_ENTRY_POINT } from '../analytics/types';

import { ADD_PANEL_MODAL_WIDTH, addPanelToNotebookTitle } from './addPanelModal';
import { buildPanelElementFromDashboard } from './buildPanelElementFromDashboard';
import { wasPanelZoomed } from './zoomedCaptureRange';

// The panel menu loads with every dashboard, so the picker, its API client and its form are split
// out of the main bundle for the sessions that never open it.
const AddPanelToNotebookModalBody = lazy(() =>
  import('./AddPanelToNotebookModalBody').then((module) => ({ default: module.AddPanelToNotebookModalBody }))
);

interface AddPanelToNotebookSceneState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
}

/**
 * The dashboard's entry point into the notebook picker. The panel menu is a plain function rather
 * than a component, so it hands the modal to DashboardScene.showModal as a scene object.
 */
export class AddPanelToNotebookScene extends SceneObjectBase<AddPanelToNotebookSceneState> {
  static Component = AddPanelToNotebookSceneRenderer;

  public onDismiss = () => {
    getDashboardSceneFor(this).closeModal();
  };

  public buildPanel = () => buildPanelElementFromDashboard(this.state.panelRef.resolve());

  public getSourceTimeRange = () => sceneGraph.getTimeRange(this.state.panelRef.resolve()).state.value;

  public wasSourceZoomed = () => wasPanelZoomed(this.state.panelRef.resolve(), this.getSourceTimeRange());

  /**
   * Read from the panel the user opened this on, not from what buildPanel returns. buildPanel inlines
   * a loaded library panel, so its element no longer says where the panel came from.
   */
  public isLibraryPanel = () => Boolean(getLibraryPanelBehavior(this.state.panelRef.resolve()));
}

function AddPanelToNotebookSceneRenderer({ model }: SceneComponentProps<AddPanelToNotebookScene>) {
  const styles = useStyles2(getStyles);

  return (
    <Modal isOpen={true} className={styles.modal} title={addPanelToNotebookTitle()} onDismiss={model.onDismiss}>
      <Suspense fallback={<Spinner />}>
        <AddPanelToNotebookModalBody
          buildPanel={model.buildPanel}
          onDismiss={model.onDismiss}
          entryPoint={NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL}
          isLibraryPanel={model.isLibraryPanel()}
          sourceTimeRange={model.getSourceTimeRange()}
          defaultLockTimeRange={model.wasSourceZoomed()}
        />
      </Suspense>
    </Modal>
  );
}

const getStyles = () => ({
  modal: css({
    width: ADD_PANEL_MODAL_WIDTH,
    maxWidth: '100%',
  }),
});
