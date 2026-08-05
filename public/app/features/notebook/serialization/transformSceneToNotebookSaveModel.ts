/**
 * Serialize an open notebook scene into a `NotebookSpec`.
 *
 * Built field by field rather than by serializing a dashboard and projecting the result down. The
 * projection worked, but it meant the dashboard serializer had to know that some layouts own elements
 * it cannot see, which is a notebook concern living in dashboard code.
 *
 * What is shared is shared by calling it, not by copying it. Panel elements and their identifiers come
 * from the dashboard serializer's own `getElements`, `timeSettings` from its `buildTimeSettings`, and a
 * panel cell's reference from the same `getElementIdentifierForVizPanel` that keys those elements.
 * Deriving any of them again here is the failure this whole change came from: two functions computing
 * an element key that nothing forces to agree.
 *
 * What is the notebook's own: its narrative cells, its layout, and the v2beta1 downgrade of panel
 * transformations, which the resource is still served on.
 */

import {
  type NotebookLayoutItemKind,
  type NotebookLayoutKind,
  type Spec as NotebookSpec,
} from '@grafana/schema/apis/notebook/v2beta1';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import {
  buildTimeSettings,
  getElements,
} from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import { dashboardSceneGraph } from 'app/features/dashboard-scene/utils/dashboardSceneGraph';

import {
  downgradeElementsToNotebookWire,
  getNotebookCellElements,
  getNotebookPanelCells,
} from './notebookSpecTransform';

export function transformSceneToNotebookSaveModel(scene: DashboardScene): NotebookSpec {
  const sceneState = scene.state;

  const notebook = {
    title: sceneState.title,
    ...(sceneState.description ? { description: sceneState.description } : {}),
    tags: sceneState.tags,
    timeSettings: buildTimeSettings(scene),
    elements: downgradeElementsToNotebookWire({
      ...getNotebookCellElements(sceneState.body),
      ...getElements(scene, scene.serializer.getDSReferencesMapping()),
    }),
    layout: resolvePanelCellReferences(sceneState.body.serialize(), sceneState.body),
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- elements/layout are the notebook's sibling kinds, built by the dashboard-typed serializer
  return notebook as unknown as NotebookSpec;
}

/**
 * Point every panel cell at the element name its panel actually serializes under.
 *
 * The layout manager writes a reference from the name it is holding, which is the name the notebook
 * loaded with. The elements map is keyed by `getElementIdentifierForVizPanel`, which asks the
 * serializer's element map and falls back to `panel-<id>` when it does not know the name. Those two
 * agree for whatever was loaded and nothing keeps them agreeing after that, and when they disagree the
 * cell references an element the spec does not contain, which renders as a cell that vanished.
 *
 * Resolving here rather than inside the manager keeps the manager free of the scene graph (that import
 * is a dependency cycle), and keeps it the layout's job to say WHICH panels it places in what order,
 * not to know how a panel is keyed.
 */
function resolvePanelCellReferences(layout: unknown, body: unknown): unknown {
  const panelCells = getNotebookPanelCells(body);
  if (Object.keys(panelCells).length === 0) {
    return layout;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a notebook layout is what a notebook layout manager serializes
  const notebookLayout = layout as NotebookLayoutKind;

  const cells: NotebookLayoutItemKind[] = notebookLayout.spec.cells.map((cell) => {
    const panel = panelCells[cell.spec.element.name];
    if (!panel) {
      return cell;
    }
    const name = dashboardSceneGraph.getElementIdentifierForVizPanel(panel);
    return name === cell.spec.element.name
      ? cell
      : { ...cell, spec: { ...cell.spec, element: { ...cell.spec.element, name } } };
  });

  return { ...notebookLayout, spec: { ...notebookLayout.spec, cells } };
}
