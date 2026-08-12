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

  return new NotebookScene({
    title: spec.title,
    description: spec.description,
    tags: spec.tags,
    // An unsaved notebook has no name to carry. `Resource.metadata.name` is not optional, so the
    // in-memory envelope `notebookResourceFor` synthesizes spells that absence as '', and '' is not a
    // uid the rest of the scene should ever see on a field that means the resource's k8s name.
    uid: resource.metadata.name || undefined,
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
}
