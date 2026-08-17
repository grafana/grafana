/**
 * Notebook Mutation Client
 *
 * `SceneMutationClient` bound to the notebook command list. This class only answers "which commands
 * exist on a notebook"; everything behind the API lives in the dispatcher.
 */

import { SceneMutationClient } from 'app/features/dashboard-scene/mutation-api/SceneMutationClient';

import { type NotebookScene } from '../scene/NotebookScene';

import { NOTEBOOK_COMMANDS } from './registry';

export class NotebookMutationClient extends SceneMutationClient<NotebookScene> {
  constructor(scene: NotebookScene) {
    super(scene, NOTEBOOK_COMMANDS);
  }
}
