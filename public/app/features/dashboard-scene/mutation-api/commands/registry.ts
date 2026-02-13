/**
 * Command Registry
 *
 * Imports all command definitions and provides lookup helpers.
 * The MutationExecutor iterates over ALL_COMMANDS generically.
 */

import { addVariableCommand } from './addVariable';
import { enterEditModeCommand } from './enterEditMode';
import { listVariablesCommand } from './listVariables';
import { removeVariableCommand } from './removeVariable';
import type { MutationCommand } from './types';
import { updateVariableCommand } from './updateVariable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each command is typed internally; the array is heterogeneous
export const ALL_COMMANDS: Array<MutationCommand<any>> = [
  addVariableCommand,
  removeVariableCommand,
  updateVariableCommand,
  listVariablesCommand,
  enterEditModeCommand,
];

/** All valid command names. */
export const MUTATION_TYPES = ALL_COMMANDS.map((cmd) => cmd.name);

/** Lookup command by name (case-insensitive). */
function findCommand(command: string): MutationCommand | undefined {
  const normalized = command.toUpperCase();
  return ALL_COMMANDS.find((cmd) => cmd.name === normalized);
}

/** Validate a payload against the Zod schema for a command. */
export function validatePayload(
  commandType: string,
  payload: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  const cmd = findCommand(commandType);
  if (!cmd) {
    return { success: false, error: `Unknown command type: ${commandType}` };
  }

  const schema = cmd.payloadSchema;

  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errorMessages = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return { success: false, error: `Validation failed: ${errorMessages.join(', ')}` };
}
