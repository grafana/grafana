/**
 * Notebook Command Registry
 *
 * The commands that exist on a notebook. NotebookMutationClient hands this to the dispatcher, which
 * iterates over it generically.
 */

import { type MutationCommand } from 'app/features/dashboard-scene/mutation-api/commands/types';

import { type NotebookScene } from '../scene/NotebookScene';

import { applyNotebookSpecCommand } from './commands/applyNotebookSpec';
import { createNotebookSpecCommand } from './commands/createNotebookSpec';
import { getNotebookSpecCommand } from './commands/getNotebookSpec';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each command is typed internally; the array is heterogeneous
export const NOTEBOOK_COMMANDS: Array<MutationCommand<any, NotebookScene>> = [
  getNotebookSpecCommand,
  applyNotebookSpecCommand,
  createNotebookSpecCommand,
];
