import {
  getUrlSyncManager,
  SceneGridItem,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectStateChangedEvent,
} from '@grafana/scenes';

import { DashboardSceneRenderer } from './DashboardSceneRenderer';

export interface DashboardSceneState extends SceneObjectState {
  title: string;
  uid?: string;
  body: SceneObject;
  actions?: SceneObject[];
  controls?: SceneObject[];
  isEditing?: boolean;
  isDirty?: boolean;
}

export class DashboardScene extends SceneObjectBase<DashboardSceneState> {
  static Component = DashboardSceneRenderer;

  constructor(state: DashboardSceneState) {
    super(state);

    this.addActivationHandler(() => {
      return () => getUrlSyncManager().cleanUp(this);
    });

    this.subscribeToEvent(SceneObjectStateChangedEvent, this.onChildStateChanged);
  }

  onChildStateChanged = (event: SceneObjectStateChangedEvent) => {
    // Temporary hacky way to detect changes
    if (event.payload.changedObject instanceof SceneGridItem) {
      this.setState({ isDirty: true });
    }
  };

  initUrlSync() {
    getUrlSyncManager().initSync(this);
  }

  onEnterEditMode = () => {
    this.setState({ isEditing: true });
  };

  onDiscard = () => {
    // TODO open confirm modal if dirty
    // TODO actually discard changes
    this.setState({ isEditing: false });
  };
}
