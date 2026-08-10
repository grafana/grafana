import { type PanelKind as DashboardPanelKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type NotebookElement, type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { buildTimeSettingsSpec } from 'app/features/dashboard-scene/serialization/shared/timeSettings';
import { vizPanelToSchemaV2 } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import {
  normalizeTransformation,
  toWireTransformation,
} from 'app/features/dashboard-scene/serialization/transformationCompat';

import { type NotebookScene } from '../scene/NotebookScene';

/**
 * Element names come off NotebookCellItem.state.elementName (recorded by the deserializer), so
 * names round-trip without a generation scheme.
 *
 * Identity is owned per cell, deliberately not in a scene-level registry like the dashboard's
 * DashboardSceneSerializer.elementPanelMap. That map exists to bridge an arbitrary string element key
 * to a numeric panel id, because a VizPanel's only identity in the scene is `panel-<id>` and it cannot
 * carry the spec's key; a notebook cell carries it directly, so a registry would just be a second,
 * driftable copy.
 *
 * Inserting, duplicating or pasting cells will need a name generator instead — belonging on
 * NotebookLayoutManager, which owns `cells` and can therefore check candidates against the names
 * already in use. It has to stay collision-proof after a delete, so a bare counter is not enough.
 * Note duplicate names are not inherently wrong: two layout items may legally reference one element,
 * and that round-trips correctly today (one `elements` entry, two layout items). The hazard is
 * specifically two cells sharing a name with *different* content, where one would silently win here.
 */
export function transformNotebookSceneToSaveModel(scene: NotebookScene): NotebookSpec {
  const { title, description, tags, body, timePicker, refreshPicker, hideTimeControls } = scene.state;

  const timeSettings = buildTimeSettingsSpec(scene.state.$timeRange, {
    timePicker,
    refreshPicker,
    hideTimeControls,
  });

  return {
    title,
    ...(description !== undefined ? { description } : {}),
    tags: tags ?? [],
    // TimeSettingsSpec is structurally identical across the two schemas, so no cast is needed.
    // The shared builder leaves fiscalYearStartMonth absent when the scene doesn't carry it (so
    // dashboard save-model diffs stay clean); the notebook spec requires it, and a loaded notebook
    // always provides it, so this default only covers scenes built from scratch.
    timeSettings: {
      ...timeSettings,
      fiscalYearStartMonth: timeSettings.fiscalYearStartMonth ?? 0,
    },
    elements: getElements(scene),
    layout: body.serialize(),
  };
}

function getElements(scene: NotebookScene): Record<string, NotebookElement> {
  const elements: Record<string, NotebookElement> = {};

  for (const cell of scene.state.body.state.cells) {
    const { elementName, body: panel, content } = cell.state;

    if (panel) {
      const element = vizPanelToSchemaV2(panel);
      elements[elementName] = element.kind === 'Panel' ? toNotebookPanel(element) : (element satisfies NotebookElement);
    } else if (content) {
      elements[elementName] = { kind: 'Cell', spec: { content } };
    }
  }

  return elements;
}

/**
 * Converts a dashboard-v2 PanelKind to the notebook's v2beta1 shape.
 *
 * The only divergence between the two schemas is transformations: vizPanelToSchemaV2 always emits
 * the v2 stable form ({ kind: 'Transformation', group: <id>, spec }), while the notebook spec (and
 * the CUE schema the backend validates against) expects the v2beta1 wire form
 * ({ kind: <id>, spec: { id: <id>, ... } }). Without this conversion a panel carrying
 * transformations would be persisted in a shape the notebook schema does not describe.
 *
 * Dashboards do the equivalent in convertSpecToWireFormat; this is the notebook's version, pinned
 * to v2beta1 because that is the notebook resource's only version today. It goes away when the
 * notebook spec migrates to v2 (team decision 0).
 */
function toNotebookPanel(panel: DashboardPanelKind): NotebookElement {
  const wireTransformations = panel.spec.data.spec.transformations.map((transformation) =>
    toWireTransformation(normalizeTransformation(transformation), 'v2beta1')
  );

  const notebookPanel = {
    ...panel,
    spec: {
      ...panel.spec,
      data: {
        ...panel.spec.data,
        spec: {
          ...panel.spec.data.spec,
          transformations: wireTransformations,
        },
      },
    },
  };

  // Everything else is structurally identical; only `transformations` differs, and it has just
  // been converted to the notebook's wire shape. TS still sees the two PanelKinds as
  // non-overlapping because of that field's declared type, hence the bridge.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- transformations converted to the v2beta1 wire shape above
  return notebookPanel as unknown as NotebookElement;
}
