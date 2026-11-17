import * as z from 'zod/mini';

import { endBatch, startBatch } from '../../actions/utils/batch';
import { type DashboardEditActionEventPayload } from '../../sidebar/events';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, MUTATION_API_ACTOR, readOnly, requiresEdit, type MutationCommand } from './types';

/** Ids for START_BATCH, unique while the page is loaded, as long as the undo history it names. */
let lastBatchId = 0;

export const startBatchCommand: MutationCommand<z.infer<typeof payloads.startBatch>> = {
  name: 'START_BATCH',
  description: z.globalRegistry.get(payloads.startBatch)?.description ?? '',
  payloadSchema: payloads.startBatch,
  permission: requiresEdit,
  readOnly: false,
  handler: async ({ description }, { scene }) => {
    enterEditModeIfNeeded(scene);
    const batchId = `batch-${++lastBatchId}`;
    startBatch(scene, description, {
      actionId: 'dashboard.editSchema',
      scope: 'mutation-api',
      actor: MUTATION_API_ACTOR,
      batchId,
    });
    return { success: true, changes: [], data: { batchId } };
  },
};

export const endBatchCommand: MutationCommand<z.infer<typeof payloads.endBatch>> = {
  name: 'END_BATCH',
  description: z.globalRegistry.get(payloads.endBatch)?.description ?? '',
  payloadSchema: payloads.endBatch,
  permission: requiresEdit,
  readOnly: false,
  handler: async (_payload, { scene }) => {
    endBatch(scene);
    return { success: true, changes: [] };
  },
};

function describeAction(action: DashboardEditActionEventPayload | undefined) {
  if (!action) {
    return null;
  }
  const { actor, batchId } = action.meta;
  return { description: action.description, actor, ...(batchId ? { batchId } : {}) };
}

export const getLastActionCommand: MutationCommand<z.infer<typeof payloads.getLastAction>> = {
  name: 'GET_LAST_ACTION',
  description: z.globalRegistry.get(payloads.getLastAction)?.description ?? '',
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

function batchMismatch(action: DashboardEditActionEventPayload | undefined, expectedBatchId: string | undefined) {
  return action !== undefined && expectedBatchId !== undefined && action.meta.batchId !== expectedBatchId;
}

export const undoCommand: MutationCommand<z.infer<typeof payloads.undo>> = {
  name: 'UNDO',
  description: z.globalRegistry.get(payloads.undo)?.description ?? '',
  payloadSchema: payloads.undo,
  permission: requiresEdit,
  readOnly: false,
  handler: async ({ expectedActor, expectedBatchId }, { scene }) => {
    const sidebar = scene.state.sidebar;
    const action = sidebar.state.undoStack.at(-1);
    if (actorMismatch(action, expectedActor)) {
      return {
        success: false,
        error: 'The last dashboard action has a different or unattributed actor. Nothing was undone.',
        changes: [],
      };
    }
    if (batchMismatch(action, expectedBatchId)) {
      return {
        success: false,
        error: 'The last dashboard action is not from that batch. Nothing was undone.',
        changes: [],
      };
    }
    sidebar.undoLastAction(MUTATION_API_ACTOR);
    return { success: true, changes: [], data: { undone: action !== undefined } };
  },
};

export const redoCommand: MutationCommand<z.infer<typeof payloads.redo>> = {
  name: 'REDO',
  description: z.globalRegistry.get(payloads.redo)?.description ?? '',
  payloadSchema: payloads.redo,
  permission: requiresEdit,
  readOnly: false,
  handler: async ({ expectedActor, expectedBatchId }, { scene }) => {
    const sidebar = scene.state.sidebar;
    const action = sidebar.state.redoStack.at(-1);
    if (actorMismatch(action, expectedActor)) {
      return {
        success: false,
        error: 'The last undone dashboard action has a different or unattributed actor. Nothing was redone.',
        changes: [],
      };
    }
    if (batchMismatch(action, expectedBatchId)) {
      return {
        success: false,
        error: 'The last undone dashboard action is not from that batch. Nothing was redone.',
        changes: [],
      };
    }
    sidebar.redoLastAction(MUTATION_API_ACTOR);
    return { success: true, changes: [], data: { redone: action !== undefined } };
  },
};
