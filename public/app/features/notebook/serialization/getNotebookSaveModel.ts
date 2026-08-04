import { sceneGraph } from '@grafana/scenes';
import {
  defaultTimeSettingsSpec,
  type NotebookElement,
  type Spec as NotebookSpec,
  type TimeSettingsSpec,
} from '@grafana/schema/apis/notebook/v2beta1';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { NotebookLayoutManager } from 'app/features/dashboard-scene/scene/layout-notebook/NotebookLayoutManager';
import { vizPanelToSchemaV2 } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';

/**
 * Serializes a notebook scene back to a NotebookSpec.
 *
 * This is the notebook's save boundary. It deliberately does not go through
 * transformSceneToSaveModelSchemaV2: that produces a DashboardV2Spec with dashboard-only fields
 * (links, cursorSync, annotations, variables, preload, editable) a notebook does not have.
 *
 * Element names come off NotebookCellItem.state.elementName, which the deserializer already
 * records, so names round-trip without a generation scheme. Inserting new cells will need one.
 */
export function getNotebookSaveModel(scene: DashboardScene): NotebookSpec {
  const { title, description, tags, body } = scene.state;

  if (!(body instanceof NotebookLayoutManager)) {
    throw new Error('Cannot serialize a notebook whose layout is not a NotebookLayoutManager');
  }

  return {
    title,
    // Optional on a notebook: keep it absent rather than writing an empty string.
    ...(description ? { description } : {}),
    tags: tags ?? [],
    timeSettings: getTimeSettings(scene),
    elements: getElements(scene, body),
    layout: body.serialize(),
  };
}

function getElements(scene: DashboardScene, body: NotebookLayoutManager): Record<string, NotebookElement> {
  const dsReferencesMapping = scene.serializer.getDSReferencesMapping();
  const elements: Record<string, NotebookElement> = {};

  for (const cell of body.state.cells) {
    const { elementName, body: panel, content } = cell.state;

    if (panel) {
      // PanelKind/LibraryPanelKind are generated identically for the dashboard and notebook
      // schemas but TS treats them as unrelated types from different modules, so widen through
      // unknown. Same bridge as NotebookLayoutSerializer's deserialize path.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- identical leaf type across the two schemas
      elements[elementName] = vizPanelToSchemaV2(panel, dsReferencesMapping) as unknown as NotebookElement;
    } else if (content) {
      elements[elementName] = { kind: 'Cell', spec: { content } };
    }
  }

  return elements;
}

// Mirrors the timeSettings block in transformSceneToSaveModelSchemaV2 (which builds it inline
// rather than exposing a helper). Kept local so the notebook does not need a third change to
// shared dashboard code.
function getTimeSettings(scene: DashboardScene): TimeSettingsSpec {
  const defaults = defaultTimeSettingsSpec();
  const timeRange = sceneGraph.getTimeRange(scene).state;
  const controlsState = scene.state.controls?.state;
  const refreshPicker = controlsState?.refreshPicker;

  return {
    timezone: timeRange.timeZone || defaults.timezone,
    from: timeRange.from,
    to: timeRange.to,
    autoRefresh: refreshPicker?.state.refresh || defaults.autoRefresh,
    autoRefreshIntervals: refreshPicker?.state.intervals || defaults.autoRefreshIntervals,
    hideTimepicker: controlsState?.hideTimeControls || defaults.hideTimepicker,
    weekStart: timeRange.weekStart,
    fiscalYearStartMonth: timeRange.fiscalYearStartMonth ?? defaults.fiscalYearStartMonth,
    nowDelay: timeRange.UNSAFE_nowDelay,
    quickRanges: controlsState?.timePicker.state.quickRanges,
  };
}
