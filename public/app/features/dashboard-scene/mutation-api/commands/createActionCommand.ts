/**
 * Builder for mutation commands that are thin wrappers around a single
 * `dashboardEditActions.*` action.
 *
 * Most write commands follow the same shape: validate a payload, resolve the
 * referenced scene objects (e.g. an element name -> the actual VizPanel), then
 * call one undoable action. `createActionCommand` captures that boilerplate so a
 * new command is just: a schema (1-1 with params), a `map` from params to the
 * action's args, and the action itself.
 *
 * Commands created this way self-register, so they only need to be imported in
 * `registry.ts` to be picked up by `ALL_COMMANDS` — no manual array entry and no
 * separate `payloads` entry (the schema travels with the command).
 */

import { type z } from 'zod';

import type { MutationResult } from '../types';

import {
  enterEditModeIfNeeded,
  requiresEdit,
  type MutationCommand,
  type MutationContext,
  type PermissionCheck,
} from './types';

interface ActionCommandConfig<Payload, ActionParams> {
  /** Command name -- must be UPPER_CASE. */
  name: string;
  description: string;
  /** Zod schema for the command params (1-1 with the public API). */
  schema: z.ZodType<Payload>;
  /** Permission check. Defaults to `requiresEdit`. */
  permission?: PermissionCheck;
  /** Maps validated params to the action's args (resolves ids -> scene objects). */
  map: (payload: Payload, context: MutationContext) => ActionParams;
  /** The `dashboardEditActions.*` action to run with the mapped args. */
  action: (params: ActionParams) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry, each command typed internally
const actionCommands: Array<MutationCommand<any>> = [];

/** All commands created via `createActionCommand` (populated as their modules load). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
export function getActionCommands(): Array<MutationCommand<any>> {
  return actionCommands;
}

export function createActionCommand<Payload, ActionParams>(
  config: ActionCommandConfig<Payload, ActionParams>
): MutationCommand<Payload> {
  const command: MutationCommand<Payload> = {
    name: config.name,
    description: config.description,
    payloadSchema: config.schema,
    permission: config.permission ?? requiresEdit,
    readOnly: false,
    handler: async (payload, context): Promise<MutationResult> => {
      enterEditModeIfNeeded(context.scene);

      try {
        config.action(config.map(payload, context));
        return { success: true, data: payload, changes: [] };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          changes: [],
        };
      }
    },
  };

  actionCommands.push(command);

  return command;
}
