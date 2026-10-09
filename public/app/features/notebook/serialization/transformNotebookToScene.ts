import { config } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker } from '@grafana/scenes';
import { type Resource } from 'app/features/apiserver/types';
import { buildSceneTimeRange } from 'app/features/dashboard-scene/serialization/shared/timeSettings';

import { NotebookScene } from '../scene/NotebookScene';
import { type Spec as NotebookSpec } from '../types';

import { deserializeNotebookLayout } from './deserializeNotebookLayout';

/**
 * Builds the notebook scene directly from the Notebook resource — no DashboardWithAccessInfo
 * envelope and no dashboard transform. The notebook shares the dashboard's leaf types
 * (TimeSettingsSpec, PanelKind) and the scene runtime, but composes its own root.
 */
export function transformNotebookToScene(resource: Resource<NotebookSpec>): NotebookScene {
  const spec = resource.spec;
  // No cast needed: TimeSettingsSpec is structurally identical across the notebook and dashboard
  // schemas, so it satisfies the shared builder's dashboard-typed signature directly.
  const timeSettings = spec.timeSettings;

  const scene = new NotebookScene({
    title: spec.title,
    description: spec.description,
    tags: spec.tags,
    uid: resource.metadata.name,
    body: deserializeNotebookLayout(spec.layout, spec.elements, { title: spec.title, tags: spec.tags }),
    $timeRange: buildSceneTimeRange(timeSettings),
    timePicker: new SceneTimePicker({
      quickRanges: timeSettings.quickRanges,
      defaultQuickRanges: config.quickRanges,
    }),
    refreshPicker: new SceneRefreshPicker({
      refresh: spec.timeSettings.autoRefresh,
      intervals: spec.timeSettings.autoRefreshIntervals,
      withText: true,
    }),
    hideTimeControls: spec.timeSettings.hideTimepicker,
  });

  // A freshly built scene's autosave has never saved anything through this instance, so without this
  // its first write would carry no resourceVersion precondition at all — not "the precondition we
  // have is stale", but no precondition whatsoever, overwriting blind. Seeding it from the resource
  // this scene was built from closes that gap for every real load. A notebook with no resource yet
  // (`notebookResourceFor(undefined, spec)`, used for a blank/draft notebook) has no resourceVersion
  // to seed, which is correct: there is nothing to protect before the first create lands.
  scene.autosave.setState({
    savedResourceVersion: resource.metadata.resourceVersion,
    savedGeneration: resource.metadata.generation,
  });

  return scene;
}
