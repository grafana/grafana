/* eslint-disable @grafana/i18n/no-untranslated-strings -- Compile-time fixtures are never rendered. */
import { type SceneObject } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { type DashboardSceneLike, type DashboardSceneState, type DashboardViewUpdate } from './types/dashboard';

// Compiled by the application typecheck, never called or imported by production code.
// setState remains compatible with enterprise snapshots until those callers migrate to updateView.
export function checkDashboardStateWriters(scene: DashboardScene, snapshot: DashboardSceneState) {
  scene.setState({ title: 'Renamed', isDirty: true });
  scene.setState({ ...{ description: 'Description' }, tags: ['test'] });
  scene.updateView({ isEditing: true, title: 'Renamed' });
  scene.updateView({ editPanel: undefined, overlay: undefined });

  scene.setState({ body: snapshot.body });
  scene.setState({ isEditing: true });
  scene.setState({ inspectPanelKey: 'panel-1' });
  scene.setState({ viewPanel: 'panel-1' });
  scene.setState({ editview: snapshot.editview });
  scene.setState({ editPanel: snapshot.editPanel });
  scene.setState({ overlay: snapshot.overlay });
  scene.setState({ shareView: 'link' });
  scene.setState({ isModalLoading: true });

  const patch = { title: 'Renamed', isEditing: true };
  scene.setState(patch);
  scene.setState({ ...patch });
  scene.setState(snapshot);
  // @ts-expect-error Transient loading state cannot be restored by callers.
  scene.updateView(snapshot);
  // @ts-expect-error Loading bookkeeping is private.
  scene.updateView({ isModalLoading: false });

  const { isModalLoading, ...restorable } = snapshot;
  scene.updateView(restorable);

  // The upstream SceneObject interface also exposes the broad setter.
  scene.setState({ viewPanel: undefined });
  const generic: SceneObject<DashboardSceneState> = scene;
  generic.setState({ viewPanel: 'panel-1' });
}

export function checkDashboardInterfaceWriters(scene: DashboardSceneLike, snapshot: DashboardSceneState) {
  scene.setState({ title: 'Renamed' });
  scene.updateView({ viewPanel: 'panel-1' });
  const patch: DashboardViewUpdate = { title: 'Renamed', viewPanel: 'panel-1' };
  scene.setState(patch);
  scene.setState({ ...{ title: 'Renamed', isEditing: true } });
  scene.setState(snapshot);
  // @ts-expect-error Loading bookkeeping is private through the interface too.
  scene.updateView({ isModalLoading: true });
}

export class DashboardInternalWriterTypecheck extends DashboardScene {
  checkInternalWrites(snapshot: DashboardSceneState) {
    this.setState({ title: 'Renamed' });
    this.updateView({ isEditing: true });
    this.setState({ isEditing: true });
    this.setState({ ...snapshot });
    // @ts-expect-error Internal callers cannot write loading state via updateView.
    this.updateView({ isModalLoading: true });
  }
}
