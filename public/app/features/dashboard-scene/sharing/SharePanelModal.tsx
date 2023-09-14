import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel, SceneObjectRef } from '@grafana/scenes';
import { Modal, TabContent } from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

interface SharePanelModalState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
}

export class SharePanelModal extends SceneObjectBase<SharePanelModalState> {
  static Component = SharePanelModalRenderer;

  constructor(state: SharePanelModalState) {
    super(state);
  }

  onClose = () => {
    const dashboard = getDashboardSceneFor(this);
    dashboard.closeModal();
  };
}

function SharePanelModalRenderer({ model }: SceneComponentProps<SharePanelModal>) {
  return (
    <Modal isOpen={true} title={'Share'} onDismiss={model.onClose}>
      <TabContent>Tab content</TabContent>
    </Modal>
  );
}
