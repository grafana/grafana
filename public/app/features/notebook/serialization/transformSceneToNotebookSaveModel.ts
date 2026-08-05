/**
 * Serialize an open notebook scene into a `NotebookSpec`.
 *
 * Built field by field rather than by serializing a dashboard and projecting the result down. The
 * projection worked, but it meant the dashboard serializer had to know that some layouts own elements
 * it cannot see, which is a notebook concern living in dashboard code.
 *
 * What is shared is shared by calling it, not by copying it. Panel elements and their identifiers come
 * from the dashboard serializer's own `getElements`, and `timeSettings` from its `buildTimeSettings`.
 * Deriving either again here is the failure this whole change came from: two functions computing an
 * element key that nothing forces to agree.
 *
 * What is the notebook's own: its narrative cells, its layout, and the v2beta1 downgrade of panel
 * transformations, which the resource is still served on.
 */

import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import {
  buildTimeSettings,
  getElements,
} from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';

import { downgradeElementsToNotebookWire, getNotebookCellElements } from './notebookSpecTransform';

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
    layout: sceneState.body.serialize(),
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- elements/layout are the notebook's sibling kinds, built by the dashboard-typed serializer
  return notebook as unknown as NotebookSpec;
}
