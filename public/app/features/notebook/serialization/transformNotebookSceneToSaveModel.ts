import { buildTimeSettingsSpec } from 'app/features/dashboard-scene/serialization/shared/timeSettings';
import { vizPanelToSchemaV2 } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';

import { type NotebookScene } from '../scene/NotebookScene';
import { type NotebookElement, type Spec as NotebookSpec } from '../types';

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
      // Both optional args must stay omitted. A dsReferencesMapping routes vizPanelToSchemaV2
      // through getAutoAssignedDSRef -> getElementIdentifierForVizPanel -> getDashboardSceneFor,
      // which throws for a NotebookScene root. isSnapshot does not throw, but it keys elements by
      // the dashboard's snapshot identifier rather than by elementName, so it would not round-trip
      // here either. Neither constraint is visible in the signature, and the save PR is where
      // someone would thread a mapping through to preserve datasource references.
      elements[elementName] = vizPanelToSchemaV2(panel);
    } else if (content) {
      elements[elementName] = { kind: 'Cell', spec: { content } };
    }
  }

  return elements;
}
