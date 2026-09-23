/* eslint-disable @grafana/i18n/no-untranslated-strings -- Compile-time fixtures are never rendered. */
import { type SceneObject } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { type DashboardSceneLike, type DashboardSceneState, type DashboardViewUpdate } from './types/dashboard';

// Compiled by the application typecheck, never called or imported by production code.
export function checkDashboardStateWriters(scene: DashboardScene, snapshot: DashboardSceneState) {
  scene.setState({ title: 'Renamed', isDirty: true });
  scene.setState({ ...{ description: 'Description' }, tags: ['test'] });
  scene.updateView({ isEditing: true, title: 'Renamed' });
  scene.updateView({ editPanel: undefined, overlay: undefined });

  // @ts-expect-error View state must participate in transition cancellation.
  scene.setState({ body: snapshot.body });
  // @ts-expect-error View state must participate in transition cancellation.
  scene.setState({ isEditing: true });
  // @ts-expect-error View state must participate in transition cancellation.
  scene.setState({ inspectPanelKey: 'panel-1' });
  // @ts-expect-error View state must participate in transition cancellation.
  scene.setState({ viewPanel: 'panel-1' });
  // @ts-expect-error View state must participate in transition cancellation.
  scene.setState({ editview: snapshot.editview });
  // @ts-expect-error View state must participate in transition cancellation.
  scene.setState({ editPanel: snapshot.editPanel });
  // @ts-expect-error View state must participate in transition cancellation.
  scene.setState({ overlay: snapshot.overlay });
  // @ts-expect-error View state must participate in transition cancellation.
  scene.setState({ shareView: 'link' });
  // @ts-expect-error Loading bookkeeping is private.
  scene.setState({ isModalLoading: true });

  const patch = { title: 'Renamed', isEditing: true };
  // @ts-expect-error Pre-typed mixed patches cannot evade the restriction.
  scene.setState(patch);
  // @ts-expect-error Spreads cannot evade the restriction.
  scene.setState({ ...patch });
  // @ts-expect-error Full snapshots contain view and transient loading state.
  scene.setState(snapshot);
  // @ts-expect-error Transient loading state cannot be restored by callers.
  scene.updateView(snapshot);
  // @ts-expect-error Loading bookkeeping is private.
  scene.updateView({ isModalLoading: false });

  const { isModalLoading, ...restorable } = snapshot;
  scene.updateView(restorable);

  // Known TypeScript-only escape hatches: exactOptionalPropertyTypes is disabled,
  // and the upstream SceneObject interface exposes its original broad setter.
  scene.setState({ viewPanel: undefined });
  const generic: SceneObject<DashboardSceneState> = scene;
  generic.setState({ viewPanel: 'panel-1' });
}

export function checkDashboardInterfaceWriters(scene: DashboardSceneLike, snapshot: DashboardSceneState) {
  scene.setState({ title: 'Renamed' });
  scene.updateView({ viewPanel: 'panel-1' });
  const patch: DashboardViewUpdate = { title: 'Renamed', viewPanel: 'panel-1' };
  // @ts-expect-error Consumer interfaces must not expose the broad upstream setter.
  scene.setState(patch);
  // @ts-expect-error Interface calls must reject mixed spreads too.
  scene.setState({ ...{ title: 'Renamed', isEditing: true } });
  // @ts-expect-error Snapshot restoration must use the transition API.
  scene.setState(snapshot);
  // @ts-expect-error Loading bookkeeping is private through the interface too.
  scene.updateView({ isModalLoading: true });
}

export class DashboardInternalWriterTypecheck extends DashboardScene {
  checkInternalWrites(snapshot: DashboardSceneState) {
    this.setState({ title: 'Renamed' });
    this.updateView({ isEditing: true });
    // @ts-expect-error Internal calls must use the same restricted setter.
    this.setState({ isEditing: true });
    // @ts-expect-error Internal spreads cannot evade the restriction.
    this.setState({ ...snapshot });
    // @ts-expect-error Internal callers cannot write loading state via updateView.
    this.updateView({ isModalLoading: true });
  }
}
