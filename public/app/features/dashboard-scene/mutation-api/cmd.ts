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

import { payloads } from './commands/schemas';
import type { MutationRequest } from './types';

// Build the type for the cmd object: one function per payload key.
type CmdBuilders = {
  [K in keyof typeof payloads]: (payload: z.infer<(typeof payloads)[K]>) => MutationRequest;
};

/**
 * Convert a camelCase command key to UPPER_SNAKE_CASE for use as the MutationRequest type.
 * Example: "addVariable" -> "ADD_VARIABLE"
 */
function toCommandType(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toUpperCase();
}

function buildCmd(): CmdBuilders {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- building the record generically; type safety is ensured by CmdBuilders return type
  const result = {} as CmdBuilders;

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing key iteration to the known keyof type
  for (const key of Object.keys(payloads) as Array<keyof typeof payloads>) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generic indexing requires cast; each entry is validated by CmdBuilders
    (result as Record<string, (payload: unknown) => MutationRequest>)[key] = (payload: unknown) => ({
      type: toCommandType(key),
      payload,
    });
  }

  return result;
}

/**
 * Type-safe command builder. Each property corresponds to a command in the
 * `payloads` record and produces a fully typed MutationRequest.
 */
export const cmd: CmdBuilders = buildCmd();
