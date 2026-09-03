/**
 * Scene Mutation Client
 *
 * The command dispatcher behind the Mutation API: callers describe *what* to change (e.g. ADD_VARIABLE,
 * APPLY_NOTEBOOK_SPEC) and this handles command lookup, permission checks, Zod payload validation and
 * execution with structured error responses.
 *
 * One dispatcher serves every document type, being generic in the scene and taking its command list
 * from the caller. A resource's command list is therefore also its answer to "which commands exist
 * here": a dashboard command is not registered on a notebook, so it cannot be run against one, which is
 * why no command carries a "is this the right kind of document" permission check.
 */

import type * as z from 'zod';

import type { MutationCommand, MutationContext } from './commands/types';
import type { MutationClient, MutationRequest, MutationResult } from './types';

/** All this dispatcher needs from a scene: somewhere to push a re-render after a write. */
export interface MutationTargetScene {
  forceRender(): void;
}

type MutationHandler<TScene> = (payload: unknown, context: MutationContext<TScene>) => Promise<MutationResult>;

interface CommandRegistration<TScene> {
  handler: MutationHandler<TScene>;
  canExecute: (scene: TScene) => { allowed: true } | { allowed: false; error: string };
  readOnly: boolean;
  payloadSchema: z.ZodType;
}

export class SceneMutationClient<TScene extends MutationTargetScene> implements MutationClient {
  private commands: Map<string, CommandRegistration<TScene>> = new Map();

  constructor(
    private scene: TScene,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload types vary per command; each is validated against its own schema before dispatch
    commands: Array<MutationCommand<any, TScene>>
  ) {
    for (const cmd of commands) {
      this.commands.set(cmd.name, {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe: the payload is validated with cmd.payloadSchema before dispatch
        handler: cmd.handler as MutationHandler<TScene>,
        canExecute: cmd.permission,
        readOnly: cmd.readOnly ?? false,
        payloadSchema: cmd.payloadSchema,
      });
    }
  }

  async execute(mutation: MutationRequest): Promise<MutationResult> {
    const type = mutation.type.toUpperCase();

    const registration = this.commands.get(type);
    if (!registration) {
      // Name what IS here: an unknown command is usually a caller aimed at the wrong document, and the
      // list says what to send instead.
      return {
        success: false,
        error: `Unknown command type: ${type}. Available commands: ${this.getAvailableCommands().join(', ')}.`,
        changes: [],
      };
    }

    const permissionResult = registration.canExecute(this.scene);
    if (!permissionResult.allowed) {
      return { success: false, error: permissionResult.error, changes: [] };
    }

    const validationResult = validatePayload(registration.payloadSchema, mutation.payload);
    if (!validationResult.success) {
      return { success: false, error: validationResult.error, changes: [] };
    }

    const context: MutationContext<TScene> = { scene: this.scene };

    try {
      // Deep-clone write payloads: a schema does not copy what it passes through, so `z.unknown()` hands
      // back the caller's own object and a handler's in-place edit would reach into the plugin's
      // argument. Inside the try because structuredClone throws on a payload it cannot clone.
      const payload = registration.readOnly ? validationResult.data : structuredClone(validationResult.data);

      const result = await registration.handler(payload, context);

      if (result.success && !registration.readOnly) {
        this.scene.forceRender();
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  }

  getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }
}

/** Flattens Zod issues into `<path>: <message>`, the shape a caller can act on and an agent can correct from. */
function validatePayload(
  schema: z.ZodType,
  payload: unknown
): { success: true; data: unknown } | { success: false; error: string } {
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
