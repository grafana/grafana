/**
 * Serialize an open notebook scene into a `NotebookSpec`.
 *
 * Everything that reads a scene is dashboard-typed: the scene serializer always emits the full
 * dashboard shape, so a notebook has to be projected back down to its own fields before it leaves.
 * Without that, a caller echoing what it read straight back through a write would be sending
 * `variables`, `annotations` and `cursorSync` into a resource that has no such fields.
 *
 * Step 1 of two, and the body is deliberately just the two calls the commands used to make
 * themselves. What it buys today is a name and a single home for the operation. Step 2 replaces the
 * body with a composition that builds a `NotebookSpec` directly instead of routing through the
 * dashboard serializer, which is what lets the dashboard side stop knowing about notebooks. The
 * equivalence test next to this file is what makes that swap safe, so it is not optional.
 */

import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';

import { type DashboardScene } from '../scene/DashboardScene';

import { dashboardSpecToNotebookSpec } from './notebookSpecTransform';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

export function transformSceneToNotebookSaveModel(scene: DashboardScene): NotebookSpec {
  return dashboardSpecToNotebookSpec(transformSceneToSaveModelSchemaV2(scene));
}
