import * as z from 'zod';

import { SceneMutationClient, type MutationTargetScene } from './SceneMutationClient';
import type { MutationCommand } from './commands/types';

/**
 * The dispatcher on synthetic commands rather than real ones.
 *
 * Its behaviour is what every document type inherits — dispatch order, the payload clone, the
 * post-write re-render, the handler-throw path — and testing it through a dashboard or notebook command
 * only covers whichever combination that command happens to be. Fake commands let each rule be aimed at
 * directly, and mean a new resource does not have to re-prove the pipeline.
 */

function scene(): MutationTargetScene & { forceRender: jest.Mock } {
  return { forceRender: jest.fn() };
}

interface TestCommandOverrides<T> {
  name?: string;
  payloadSchema?: z.ZodType<T>;
  permission?: MutationCommand<T, MutationTargetScene>['permission'];
  readOnly?: boolean;
  handler?: MutationCommand<T, MutationTargetScene>['handler'];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fixture is generic over whatever payload a test's schema produces
function command<T = any>(overrides: TestCommandOverrides<T> = {}): MutationCommand<T, MutationTargetScene> {
  return {
    name: 'TEST_COMMAND',
    description: 'A command that exists only for this suite.',
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- default schema for tests that do not care about the payload
    payloadSchema: z.object({}) as unknown as z.ZodType<T>,
    permission: () => ({ allowed: true }),
    handler: async () => ({ success: true, changes: [] }),
    ...overrides,
  };
}

describe('SceneMutationClient', () => {
  describe('command lookup', () => {
    it('names the commands that do exist when asked for one that does not', async () => {
      const client = new SceneMutationClient(scene(), [command({ name: 'FIRST' }), command({ name: 'SECOND' })]);

      const result = await client.execute({ type: 'MISSING', payload: {} });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown command type: MISSING. Available commands: FIRST, SECOND.');
    });

    it('matches the command name case-insensitively', async () => {
      const handler = jest.fn(async () => ({ success: true, changes: [] }));
      const client = new SceneMutationClient(scene(), [command({ name: 'TEST_COMMAND', handler })]);

      const result = await client.execute({ type: 'test_command', payload: {} });

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('dispatch order', () => {
    it('refuses on permission before it validates the payload', async () => {
      const handler = jest.fn(async () => ({ success: true, changes: [] }));
      const client = new SceneMutationClient(scene(), [
        command({
          permission: () => ({ allowed: false, error: 'Cannot edit dashboard: insufficient permissions' }),
          payloadSchema: z.object({ required: z.string() }),
          handler,
        }),
      ]);

      // A payload that would also fail validation: the permission error is the one that has to come
      // back, or a caller without access learns the shape of a command it may not run.
      const result = await client.execute({ type: 'TEST_COMMAND', payload: {} });

      expect(result).toEqual({
        success: false,
        error: 'Cannot edit dashboard: insufficient permissions',
        changes: [],
      });
      expect(handler).not.toHaveBeenCalled();
    });

    it('reports validation failures per field, and does not run the handler', async () => {
      const handler = jest.fn(async () => ({ success: true, changes: [] }));
      const client = new SceneMutationClient(scene(), [
        command({ payloadSchema: z.object({ title: z.string() }), handler }),
      ]);

      const result = await client.execute({ type: 'TEST_COMMAND', payload: { title: 42 } });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed:');
      expect(result.error).toContain('title:');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('payload clone', () => {
    it('gives a write command a payload it can mutate without touching the caller', async () => {
      const client = new SceneMutationClient(scene(), [
        // `z.unknown()` is what makes the aliasing visible, and it is what the full-spec commands use
        // for the spec they carry. A `z.object` or `z.record` builds a fresh object as it parses, which
        // hides the aliasing rather than being safe from it — write this schema either of those ways
        // and the test passes with the clone taken out.
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the payload shape is the test's own; z.unknown() cannot express it
        command<{ spec: Record<string, unknown> }>({
          payloadSchema: z.object({ spec: z.unknown() }) as unknown as z.ZodType<{ spec: Record<string, unknown> }>,
          handler: async (payload) => {
            payload.spec.title = 'mutated by the handler';
            return { success: true, changes: [] };
          },
        }),
      ]);

      const callerPayload = { spec: { title: 'as the caller wrote it' } };
      await client.execute({ type: 'TEST_COMMAND', payload: callerPayload });

      expect(callerPayload.spec.title).toBe('as the caller wrote it');
    });

    it('hands a read command the parsed payload as-is', async () => {
      let received: unknown;
      const client = new SceneMutationClient(scene(), [
        command({
          readOnly: true,
          payloadSchema: z.object({ spec: z.unknown() }),
          handler: async (payload) => {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- reading back what the dispatcher passed
            received = (payload as { spec: unknown }).spec;
            return { success: true, changes: [] };
          },
        }),
      ]);

      // No clone on the read path, which is the other half of what `readOnly` decides.
      const spec = { title: 'as the caller wrote it' };
      await client.execute({ type: 'TEST_COMMAND', payload: { spec } });

      expect(received).toBe(spec);
    });
  });

  describe('re-render', () => {
    it('re-renders the scene after a write that succeeded', async () => {
      const target = scene();
      const client = new SceneMutationClient(target, [command()]);

      await client.execute({ type: 'TEST_COMMAND', payload: {} });

      expect(target.forceRender).toHaveBeenCalledTimes(1);
    });

    it('does not re-render after a read', async () => {
      const target = scene();
      const client = new SceneMutationClient(target, [command({ readOnly: true })]);

      await client.execute({ type: 'TEST_COMMAND', payload: {} });

      expect(target.forceRender).not.toHaveBeenCalled();
    });

    it('does not re-render when the handler reports failure', async () => {
      const target = scene();
      const client = new SceneMutationClient(target, [
        command({ handler: async () => ({ success: false, error: 'nothing was changed', changes: [] }) }),
      ]);

      await client.execute({ type: 'TEST_COMMAND', payload: {} });

      expect(target.forceRender).not.toHaveBeenCalled();
    });
  });

  describe('handler failure', () => {
    it('turns a throw into a result instead of rejecting', async () => {
      const target = scene();
      const client = new SceneMutationClient(target, [
        command({
          handler: async () => {
            throw new Error('the layout manager does not support this');
          },
        }),
      ]);

      // The API is a plugin surface: a rejected promise crosses the boundary as an opaque failure,
      // where a result carries the reason.
      const result = await client.execute({ type: 'TEST_COMMAND', payload: {} });

      expect(result).toEqual({
        success: false,
        error: 'the layout manager does not support this',
        changes: [],
      });
      expect(target.forceRender).not.toHaveBeenCalled();
    });

    it('stringifies a thrown non-Error', async () => {
      const client = new SceneMutationClient(scene(), [
        command({
          handler: async () => {
            // eslint-disable-next-line no-throw-literal -- exercising the non-Error branch
            throw 'a bare string';
          },
        }),
      ]);

      const result = await client.execute({ type: 'TEST_COMMAND', payload: {} });

      expect(result.error).toBe('a bare string');
    });
  });
});
