import * as z from 'zod';

import { SceneMutationClient, type MutationTargetScene } from './SceneMutationClient';
import type { LazyMutationCommand, MutationCommand } from './commands/types';

// Synthetic commands rather than real ones: testing the dispatcher through a dashboard or notebook
// command only covers whichever combination that command happens to be.

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
    it.each([true, false])('reports readOnly=%s without loading lazy commands', (readOnly) => {
      class InspectableClient extends SceneMutationClient<MutationTargetScene> {
        public isReadOnly(type: string) {
          return super.isReadOnly(type);
        }
      }

      const load = jest.fn(async () => command({ name: 'LAZY_COMMAND', readOnly }));
      const client = new InspectableClient(scene(), [
        { name: 'LAZY_COMMAND', readOnly, load },
        command({ name: 'EAGER_COMMAND', readOnly }),
        { name: 'DEFAULT_COMMAND', load },
      ]);

      expect(client.getAvailableCommands()).toEqual(['LAZY_COMMAND', 'EAGER_COMMAND', 'DEFAULT_COMMAND']);
      expect(client.isReadOnly('lazy_command')).toBe(readOnly);
      expect(client.isReadOnly('eager_command')).toBe(readOnly);
      expect(client.isReadOnly('DEFAULT_COMMAND')).toBe(false);
      expect(client.isReadOnly('UNKNOWN_COMMAND')).toBe(false);
      expect(load).not.toHaveBeenCalled();
    });

    it('loads a lazy command only when it is first executed', async () => {
      const load = jest.fn(async () => command({ name: 'LAZY_COMMAND' }));
      const lazyCommand: LazyMutationCommand<MutationTargetScene> = { name: 'LAZY_COMMAND', load };
      const client = new SceneMutationClient(scene(), [lazyCommand]);

      expect(client.getAvailableCommands()).toEqual(['LAZY_COMMAND']);
      expect(load).not.toHaveBeenCalled();

      await client.execute({ type: 'LAZY_COMMAND', payload: {} });
      await client.execute({ type: 'LAZY_COMMAND', payload: {} });

      expect(load).toHaveBeenCalledTimes(1);
    });

    it('shares an in-flight lazy load and caches the successful registration', async () => {
      let resolveLoad!: () => void;
      const pendingLoad = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });
      const handler = jest.fn(async () => ({ success: true, changes: [] }));
      const load = jest.fn(async () => {
        await pendingLoad;
        return command({ name: 'LAZY_COMMAND', handler });
      });
      const client = new SceneMutationClient(scene(), [{ name: 'LAZY_COMMAND', load }]);

      const first = client.execute({ type: 'LAZY_COMMAND', payload: {} });
      const second = client.execute({ type: 'LAZY_COMMAND', payload: {} });

      expect(load).toHaveBeenCalledTimes(1);
      expect(handler).not.toHaveBeenCalled();

      resolveLoad();
      expect(await Promise.all([first, second])).toEqual([
        { success: true, changes: [] },
        { success: true, changes: [] },
      ]);
      expect(await client.execute({ type: 'LAZY_COMMAND', payload: {} })).toEqual({ success: true, changes: [] });
      expect(load).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it.each([
      { name: 'Error', error: new Error('Failed to load command') },
      { name: 'non-Error', error: 'Failed to load command' },
    ])('retries a shared lazy load after a $name rejection and caches success', async ({ error }) => {
      let rejectLoad!: (reason: unknown) => void;
      const pendingLoad = new Promise<never>((_resolve, reject) => {
        rejectLoad = reject;
      });
      const handler = jest.fn(async () => ({ success: true, changes: [] }));
      const load = jest
        .fn(async () => command({ name: 'LAZY_COMMAND', handler }))
        .mockImplementationOnce(() => pendingLoad);
      const target = scene();
      const client = new SceneMutationClient(target, [{ name: 'LAZY_COMMAND', load }]);

      const first = client.execute({ type: 'LAZY_COMMAND', payload: {} });
      const second = client.execute({ type: 'LAZY_COMMAND', payload: {} });
      expect(load).toHaveBeenCalledTimes(1);

      rejectLoad(error);
      expect(await Promise.all([first, second])).toEqual([
        { success: false, error: 'Failed to load command', changes: [] },
        { success: false, error: 'Failed to load command', changes: [] },
      ]);
      expect(handler).not.toHaveBeenCalled();
      expect(target.forceRender).not.toHaveBeenCalled();

      expect(
        await Promise.all([
          client.execute({ type: 'LAZY_COMMAND', payload: {} }),
          client.execute({ type: 'LAZY_COMMAND', payload: {} }),
        ])
      ).toEqual([
        { success: true, changes: [] },
        { success: true, changes: [] },
      ]);
      expect(await client.execute({ type: 'LAZY_COMMAND', payload: {} })).toEqual({ success: true, changes: [] });
      expect(load).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledTimes(3);
      expect(target.forceRender).toHaveBeenCalledTimes(3);
    });

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

      // The payload would also fail validation, but a caller without access must not learn the shape of a
      // command it may not run.
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
        // `z.unknown()` is what makes the aliasing visible, and what the full-spec commands use. A
        // `z.object` or `z.record` builds a fresh object as it parses, hiding the aliasing rather than
        // being safe from it: write it either of those ways and the test passes with the clone taken out.
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

      // A rejected promise crosses the plugin boundary as an opaque failure; a result carries the reason.
      const result = await client.execute({ type: 'TEST_COMMAND', payload: {} });

      expect(result).toEqual({
        success: false,
        error: 'the layout manager does not support this',
        changes: [],
      });
      expect(target.forceRender).not.toHaveBeenCalled();
    });

    it('turns a non-cloneable payload into a result instead of rejecting', async () => {
      const handler = jest.fn(async () => ({ success: true, changes: [] }));
      const target = scene();
      const client = new SceneMutationClient(target, [
        command({
          // Passes through whatever it is handed, which is what a spec-shaped `z.unknown()` field does.
          payloadSchema: z.object({ value: z.unknown() }),
          handler,
        }),
      ]);

      // A write payload is deep-cloned, and structuredClone throws on a function.
      const result = await client.execute({ type: 'TEST_COMMAND', payload: { value: () => 'not cloneable' } });

      expect(result.success).toBe(false);
      expect(result.error).toEqual(expect.stringMatching(/clone/i));
      expect(handler).not.toHaveBeenCalled();
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
