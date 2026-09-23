/* eslint-disable @grafana/i18n/no-untranslated-strings -- Compile-time fixtures are never rendered. */
import { type VizPanel } from '@grafana/scenes';

import { type DashboardScene } from './DashboardScene';
import { dashboardViews } from './dashboardViewRegistry';
import { type DashboardSceneLike, type DashboardSceneState } from './types/dashboard';

// Compiled by the application typecheck, never called or imported by production code.
export function checkDashboardStateWriters(scene: DashboardScene, snapshot: DashboardSceneState, panel: VizPanel) {
  scene.setState(snapshot);
  scene.setState({ title: 'Renamed', isEditing: true });
  const consumer: DashboardSceneLike = scene;
  consumer.setState(snapshot);

  scene.loadView(dashboardViews.editPanel(panel, true));
  scene.loadView(dashboardViews.overlay.filters());
  // @ts-expect-error Unregistered fields cannot own a view request.
  scene.loadView({ key: 'title', load: async () => 'Renamed' });
  // @ts-expect-error Loading bookkeeping cannot own a view request.
  scene.loadView({ key: 'isModalLoading', load: async () => true });
  // @ts-expect-error The result must match the registered target field.
  scene.loadView({ key: 'editPanel', load: async () => 'not a panel editor' });
  // @ts-expect-error Registered loaders retain their argument types.
  dashboardViews.editPanel('not a panel');
  // @ts-expect-error Synchronous state keys are not callable loaders.
  dashboardViews.body();
}
