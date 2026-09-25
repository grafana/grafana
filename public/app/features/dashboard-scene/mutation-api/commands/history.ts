import type * as z from 'zod';

import { endBatch, startBatch } from '../../actions/utils/batch';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, readOnly, requiresEdit, type MutationCommand } from './types';

export const startBatchCommand: MutationCommand<z.infer<typeof payloads.startBatch>> = {
  name: 'START_BATCH',
  description: payloads.startBatch.description ?? '',
  payloadSchema: payloads.startBatch,
  permission: requiresEdit,
  handler: async ({ description }, { scene }) => {
    enterEditModeIfNeeded(scene);
    startBatch(scene, description, 'mutation-api');
    return { success: true, changes: [] };
  },
};

export const endBatchCommand: MutationCommand = {
  name: 'END_BATCH',
  description: payloads.endBatch.description ?? '',
  payloadSchema: payloads.endBatch,
  permission: requiresEdit,
  handler: async (_payload, { scene }) => {
    endBatch(scene);
    return { success: true, changes: [] };
  },
};

export const getLastActionCommand: MutationCommand = {
  name: 'GET_LAST_ACTION',
  description: payloads.getLastAction.description ?? '',
  payloadSchema: payloads.getLastAction,
  permission: readOnly,
  readOnly: true,
  handler: async (_payload, { scene }) => {
    const action = scene.state.sidebar.state.undoStack.at(-1);
    return {
      success: true,
      changes: [],
      data: { action: action ? { description: action.description, actor: action.actor } : null },
    };
  },
};

export const undoCommand: MutationCommand<z.infer<typeof payloads.undo>> = {
  name: 'UNDO',
  description: payloads.undo.description ?? '',
  payloadSchema: payloads.undo,
  permission: requiresEdit,
  handler: async ({ expectedActor }, { scene }) => {
    const sidebar = scene.state.sidebar;
    const action = sidebar.state.undoStack.at(-1);
    if (action && expectedActor !== undefined && action.actor !== expectedActor) {
      return {
        success: false,
        error: 'The last dashboard action has a different or unattributed actor. Nothing was undone.',
        changes: [],
      };
    }
    const undone = action !== undefined;
    sidebar.undoAction();
    return { success: true, changes: [], data: { undone } };
  },
};
