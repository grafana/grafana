/**
 * Notebook Mutation Client
 *
 * The Mutation API as a notebook sees it: `SceneMutationClient` bound to the notebook command list.
 * Everything behind the API — dispatch order, permission checks, payload validation, the post-write
 * re-render — lives in the dispatcher and is shared with dashboards. This class only answers "which
 * commands exist on a notebook".
 */

import { SceneMutationClient } from 'app/features/dashboard-scene/mutation-api/SceneMutationClient';

import { type NotebookScene } from '../scene/NotebookScene';

import { NOTEBOOK_COMMANDS } from './registry';

export class NotebookMutationClient extends SceneMutationClient<NotebookScene> {
  constructor(scene: NotebookScene) {
    super(scene, NOTEBOOK_COMMANDS);
  }
}
