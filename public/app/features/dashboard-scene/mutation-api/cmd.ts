/**
 * Typed command builder for the Dashboard Mutation API.
 *
 * Provides one type-safe factory function per command, derived from the
 * `payloads` record in schemas.ts. Each function produces a MutationRequest
 * ready to pass to DashboardMutationClient.execute() or any MutationClient.
 *
 * Key naming: camelCase payload key -> UPPER_SNAKE_CASE type string.
 *
 * Usage:
 *   import { cmd } from './cmd';
 *   const result = await client.execute(cmd.addVariable({ variable: myVar }));
 */

import { type z } from 'zod';

import { isSceneObject, type SceneVariable } from '@grafana/scenes';

import { payloads } from './commands/schemas';
import type { MutationRequest } from './types';

// Build the type for the cmd object: one function per payload key.
type CmdBuilders = {
  [K in keyof typeof payloads]: (payload: z.input<(typeof payloads)[K]>) => MutationRequest;
};

// Scenes-native overloads for variable commands: UI callers pass SceneVariable directly.
export interface SceneNativeCmdBuilders {
  addVariable(sceneVar: SceneVariable): MutationRequest;
  addVariable(payload: z.input<(typeof payloads)['addVariable']>): MutationRequest;
  updateVariable(sceneVar: SceneVariable): MutationRequest;
  updateVariable(payload: z.input<(typeof payloads)['updateVariable']>): MutationRequest;
  removeVariable(sceneVar: SceneVariable): MutationRequest;
  removeVariable(payload: z.input<(typeof payloads)['removeVariable']>): MutationRequest;
}

/**
 * Convert a camelCase command key to UPPER_SNAKE_CASE for use as the MutationRequest type.
 * Example: "addVariable" -> "ADD_VARIABLE"
 */
function toCommandType(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toUpperCase();
}

function buildCmd(): CmdBuilders & SceneNativeCmdBuilders {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- building the record generically; type safety is ensured by CmdBuilders return type
  const result = {} as CmdBuilders & SceneNativeCmdBuilders;

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing key iteration to the known keyof type
  for (const key of Object.keys(payloads) as Array<keyof typeof payloads>) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generic indexing requires cast; each entry is validated by CmdBuilders
    (result as unknown as Record<string, (payload: unknown) => MutationRequest>)[key] = (payload: unknown) => ({
      type: toCommandType(key),
      payload,
    });
  }

  // Scenes-native overloads: detect SceneVariable instance and bypass Zod roundtrip.
  const variableCommands = ['addVariable', 'updateVariable', 'removeVariable'] as const;
  for (const key of variableCommands) {
    const commandType = toCommandType(key);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- overriding generated builder with overloaded version
    (result as unknown as Record<string, (arg: unknown) => MutationRequest>)[key] = (arg: unknown) => {
      if (isSceneObject(arg)) {
        return { type: commandType, __scenesPayload: arg };
      }
      return { type: commandType, payload: arg };
    };
  }

  return result;
}

/**
 * Type-safe command builder. Each property corresponds to a command in the
 * `payloads` record and produces a fully typed MutationRequest.
 *
 * Variable commands (addVariable, updateVariable, removeVariable) also accept
 * a SceneVariable directly for UI callers, bypassing the Zod roundtrip.
 */
export const cmd: CmdBuilders & SceneNativeCmdBuilders = buildCmd();
