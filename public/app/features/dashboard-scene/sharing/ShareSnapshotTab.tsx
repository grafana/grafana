import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';

export interface ShareSnapshotTabState extends SceneObjectState {
  panelRef?: SceneObjectRef<VizPanel>;
}

export class ShareSnapshotTab extends SceneObjectBase<ShareSnapshotTabState> {
  public getTabLabel() {
    return t('share-modal.tab-title.snapshot', 'Snapshot');
  }

  static Component = ({ model }: SceneComponentProps<ShareSnapshotTab>) => {
    return <div>Snapshot</div>;
  };
}
