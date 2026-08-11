/**
 * Notebook Command Registry
 *
 * The commands that exist on a notebook. NotebookMutationClient hands this to the dispatcher, which
 * iterates over it generically.
 *
 * Nothing dashboard-only is here, and nothing here is on a dashboard except CREATE — which is why a
 * dashboard command asked of a notebook is simply not found, and vice versa. No command needs to check
 * which document it is looking at.
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
