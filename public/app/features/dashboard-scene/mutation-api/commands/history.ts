import type * as z from 'zod';

import { endBatch, startBatch } from '../../actions/utils/batch';
import { type DashboardEditActionEventPayload } from '../../sidebar/events';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, MUTATION_API_ACTOR, readOnly, requiresEdit, type MutationCommand } from './types';

export const startBatchCommand: MutationCommand<z.infer<typeof payloads.startBatch>> = {
  name: 'START_BATCH',
  description: payloads.startBatch.description ?? '',
  payloadSchema: payloads.startBatch,
  permission: requiresEdit,
  readOnly: false,
  handler: async ({ description }, { scene }) => {
    enterEditModeIfNeeded(scene);
    startBatch(scene, description, {
      actionId: 'dashboard.editSchema',
      scope: 'mutation-api',
      actor: MUTATION_API_ACTOR,
    });
    return { success: true, changes: [] };
  },
};

export const endBatchCommand: MutationCommand<z.infer<typeof payloads.endBatch>> = {
  name: 'END_BATCH',
  description: payloads.endBatch.description ?? '',
  payloadSchema: payloads.endBatch,
  permission: requiresEdit,
  readOnly: false,
  handler: async (_payload, { scene }) => {
    endBatch(scene);
    return { success: true, changes: [] };
  },
};

function describeAction(action: DashboardEditActionEventPayload | undefined) {
  return action ? { description: action.description, actor: action.meta.actor } : null;
}

export const getLastActionCommand: MutationCommand<z.infer<typeof payloads.getLastAction>> = {
  name: 'GET_LAST_ACTION',
  description: payloads.getLastAction.description ?? '',
  payloadSchema: payloads.getLastAction,
  permission: readOnly,
  readOnly: true,
  handler: async (_payload, { scene }) => {
    const { undoStack, redoStack } = scene.state.sidebar.state;
    return {
      success: true,
      changes: [],
      data: { action: describeAction(undoStack.at(-1)), undoneAction: describeAction(redoStack.at(-1)) },
    };
  },
};

function actorMismatch(action: DashboardEditActionEventPayload | undefined, expectedActor: string | undefined) {
  return action !== undefined && expectedActor !== undefined && action.meta.actor !== expectedActor;
}

export const undoCommand: MutationCommand<z.infer<typeof payloads.undo>> = {
  name: 'UNDO',
  description: payloads.undo.description ?? '',
  payloadSchema: payloads.undo,
  permission: requiresEdit,
  readOnly: false,
  handler: async ({ expectedActor }, { scene }) => {
    const sidebar = scene.state.sidebar;
    const action = sidebar.state.undoStack.at(-1);
    if (actorMismatch(action, expectedActor)) {
      return {
        success: false,
        error: 'The last dashboard action has a different or unattributed actor. Nothing was undone.',
        changes: [],
      };
    }
    sidebar.undoLastAction(MUTATION_API_ACTOR);
    return { success: true, changes: [], data: { undone: action !== undefined } };
  },
};

export const redoCommand: MutationCommand<z.infer<typeof payloads.redo>> = {
  name: 'REDO',
  description: payloads.redo.description ?? '',
  payloadSchema: payloads.redo,
  permission: requiresEdit,
  readOnly: false,
  handler: async ({ expectedActor }, { scene }) => {
    const sidebar = scene.state.sidebar;
    const action = sidebar.state.redoStack.at(-1);
    if (actorMismatch(action, expectedActor)) {
      return {
        success: false,
        error: 'The last undone dashboard action has a different or unattributed actor. Nothing was redone.',
        changes: [],
      };
    }
    sidebar.redoLastAction(MUTATION_API_ACTOR);
    return { success: true, changes: [], data: { redone: action !== undefined } };
  },
};
