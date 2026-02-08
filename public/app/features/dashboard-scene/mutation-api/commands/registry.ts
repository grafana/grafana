/**
 * Command Registry
 *
 * Imports all command definitions and provides lookup helpers.
 * The MutationExecutor iterates over ALL_COMMANDS generically.
 */

import { addPanelCommand } from './addPanel';
import { addVariableCommand } from './addVariable';
import { enterEditModeCommand } from './enterEditMode';
import { getDashboardSettingsCommand } from './getDashboardSettings';
import { listVariablesCommand } from './listVariables';
import { removePanelCommand } from './removePanel';
import { removeVariableCommand } from './removeVariable';
import type { CommandDefinition } from './types';
import { updateDashboardSettingsCommand } from './updateDashboardSettings';
import { updatePanelCommand } from './updatePanel';
import { updateVariableCommand } from './updateVariable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each command is typed internally; the array is heterogeneous
export const ALL_COMMANDS: Array<CommandDefinition<any>> = [
  addPanelCommand,
  removePanelCommand,
  updatePanelCommand,
  addVariableCommand,
  removeVariableCommand,
  updateVariableCommand,
  listVariablesCommand,
  getDashboardSettingsCommand,
  updateDashboardSettingsCommand,
  enterEditModeCommand,
];

/** All valid command names. */
export const MUTATION_TYPES = ALL_COMMANDS.map((cmd) => cmd.name);

/** Lookup command by name (case-insensitive). */
function findCommand(command: string): CommandDefinition | undefined {
  const normalized = command.toUpperCase();
  return ALL_COMMANDS.find((cmd) => cmd.name === normalized);
}

/** Validate a payload against the Zod schema for a command. */
export function validatePayload(
  commandType: string,
  payload: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  const schema = findCommand(commandType)?.payloadSchema ?? null;
  if (!schema) {
    return { success: true, data: payload };
  }

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
