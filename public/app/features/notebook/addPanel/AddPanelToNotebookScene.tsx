import { css } from '@emotion/css';
import { lazy, Suspense } from 'react';

import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { Modal, Spinner, useStyles2 } from '@grafana/ui';
import { vizPanelToSchemaV2 } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/utils';

import { ADD_PANEL_MODAL_WIDTH, addPanelToNotebookTitle } from './addPanelModal';

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

  /**
   * Both optional args stay omitted. A dsReferencesMapping would write back the dashboard's
   * unresolved default datasource, and the notebook is a different document — it should carry the
   * datasource the panel actually queried, not inherit whatever default the dashboard had.
   */
  public buildPanel = () => vizPanelToSchemaV2(this.state.panelRef.resolve());
}

function AddPanelToNotebookSceneRenderer({ model }: SceneComponentProps<AddPanelToNotebookScene>) {
  const styles = useStyles2(getStyles);

  return (
    <Modal isOpen={true} className={styles.modal} title={addPanelToNotebookTitle()} onDismiss={model.onDismiss}>
      <Suspense fallback={<Spinner />}>
        <AddPanelToNotebookModalBody buildPanel={model.buildPanel} onDismiss={model.onDismiss} />
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
