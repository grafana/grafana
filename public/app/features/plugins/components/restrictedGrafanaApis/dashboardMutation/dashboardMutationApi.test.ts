import { ALL_COMMANDS } from 'app/features/dashboard-scene/mutation-api';
import type { MutationClient, MutationRequest, MutationResult } from 'app/features/dashboard-scene/mutation-api/types';
import { createMutationClient } from 'app/features/dashboard-scene/scene/DashboardMutationClientSetter';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { dashboardMutationApi, setDashboardMutationClientForTests } from './dashboardMutationApi';

function createMockClient(): MutationClient {
  return {
    execute: jest.fn(
      async (_mutation: MutationRequest): Promise<MutationResult> => ({
        success: true,
        changes: [],
      })
    ),
    getAvailableCommands: jest.fn(() => []),
    canExecute: jest.fn(() => ({ allowed: true }) as const),
  };
}

describe('dashboardMutationApi', () => {
  afterEach(() => {
    setDashboardMutationClientForTests(null);
  });

  describe('execute', () => {
    it('throws when no client is registered', async () => {
      await expect(dashboardMutationApi.execute({ type: 'LIST_VARIABLES', payload: {} })).rejects.toThrow(
        'Dashboard Mutation API is not available'
      );
    });

    it('delegates to the registered client', async () => {
      const client = createMockClient();
      setDashboardMutationClientForTests(client);

      const result = await dashboardMutationApi.execute({ type: 'LIST_VARIABLES', payload: {} });
      expect(result.success).toBe(true);
      expect(client.execute).toHaveBeenCalledWith({ type: 'LIST_VARIABLES', payload: {} });
    });

    it('throws after client is unregistered', async () => {
      const client = createMockClient();
      setDashboardMutationClientForTests(client);
      setDashboardMutationClientForTests(null);

      await expect(dashboardMutationApi.execute({ type: 'LIST_VARIABLES', payload: {} })).rejects.toThrow(
        'Dashboard Mutation API is not available'
      );
    });
  });

  describe('getPayloadSchema', () => {
    it('returns schema for registered commands', () => {
      for (const cmd of ALL_COMMANDS) {
        const schema = dashboardMutationApi.getPayloadSchema(cmd.name);
        expect(schema).toBeDefined();
        expect(typeof schema!.safeParse).toBe('function');
      }
    });

    it('returns null for unknown commands', () => {
      expect(dashboardMutationApi.getPayloadSchema('UNKNOWN_COMMAND')).toBeNull();
    });

    it('is case-insensitive', () => {
      for (const cmd of ALL_COMMANDS) {
        const lower = dashboardMutationApi.getPayloadSchema(cmd.name.toLowerCase());
        const upper = dashboardMutationApi.getPayloadSchema(cmd.name.toUpperCase());
        expect(lower).toBe(upper);
        expect(lower).toBeDefined();
      }
    });

    it('returns the same schema as the command registry', () => {
      for (const cmd of ALL_COMMANDS) {
        const schema = dashboardMutationApi.getPayloadSchema(cmd.name);
        expect(schema).toBe(cmd.payloadSchema);
      }
    });
  });

  describe('isAvailable', () => {
    it('is false until a dashboard is loaded, and false again once it unloads', () => {
      expect(dashboardMutationApi.isAvailable()).toBe(false);

      setDashboardMutationClientForTests(createMockClient());
      expect(dashboardMutationApi.isAvailable()).toBe(true);

      setDashboardMutationClientForTests(null);
      expect(dashboardMutationApi.isAvailable()).toBe(false);
    });
  });

  describe('canExecute', () => {
    it('reports every requested command as blocked when no dashboard is open', () => {
      const permission = dashboardMutationApi.canExecute(['ADD_PANEL', 'REMOVE_PANEL']);

      expect(permission).toEqual({
        allowed: false,
        blocked: [
          { command: 'ADD_PANEL', reason: expect.stringContaining('No dashboard is currently open') },
          { command: 'REMOVE_PANEL', reason: expect.stringContaining('No dashboard is currently open') },
        ],
      });
    });

    it('accepts a single command name', () => {
      expect(dashboardMutationApi.canExecute('add_panel')).toEqual({
        allowed: false,
        blocked: [{ command: 'ADD_PANEL', reason: expect.any(String) }],
      });
    });

    // All-of over nothing. Called with a tool's command list, an empty list means
    // the caller needs no commands, not that it should be refused.
    it('allows an empty list', () => {
      expect(dashboardMutationApi.canExecute([])).toEqual({ allowed: true });
    });

    it('delegates to the client once a dashboard is open', () => {
      const client = createMockClient();
      setDashboardMutationClientForTests(client);

      expect(dashboardMutationApi.canExecute(['ADD_PANEL'])).toEqual({ allowed: true });
      expect(client.canExecute).toHaveBeenCalledWith(['ADD_PANEL']);
    });
  });

  describe('onAvailabilityChange', () => {
    it('notifies on load and unload', () => {
      const listener = jest.fn();
      dashboardMutationApi.onAvailabilityChange(listener);

      setDashboardMutationClientForTests(createMockClient());
      expect(listener).toHaveBeenCalledWith(true);

      setDashboardMutationClientForTests(null);
      expect(listener).toHaveBeenCalledWith(false);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('stops notifying once unsubscribed', () => {
      const listener = jest.fn();
      const unsubscribe = dashboardMutationApi.onAvailabilityChange(listener);
      unsubscribe();

      setDashboardMutationClientForTests(createMockClient());

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not notify when the same client is set again', () => {
      const client = createMockClient();
      setDashboardMutationClientForTests(client);

      const listener = jest.fn();
      dashboardMutationApi.onAvailabilityChange(listener);
      setDashboardMutationClientForTests(client);

      expect(listener).not.toHaveBeenCalled();
    });

    it('keeps notifying the other listeners when one throws', () => {
      const thrower = jest.fn(() => {
        throw new Error('listener boom');
      });
      const listener = jest.fn();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const unsubscribeThrower = dashboardMutationApi.onAvailabilityChange(thrower);
      const unsubscribeListener = dashboardMutationApi.onAvailabilityChange(listener);

      setDashboardMutationClientForTests(createMockClient());

      expect(thrower).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(true);

      unsubscribeThrower();
      unsubscribeListener();
      jest.mocked(console.error).mockRestore();
    });
  });

  describe('scene teardown', () => {
    const sceneA = {} as DashboardScene;
    const sceneB = {} as DashboardScene;

    // Two dashboard scenes can be mounted at once, and they do not deactivate in
    // activation order. Clearing the client unconditionally on teardown left the
    // surviving scene with no mutation API.
    it('leaves the live client alone when a superseded scene deactivates', () => {
      const teardownA = createMutationClient(sceneA);
      const teardownB = createMutationClient(sceneB);

      teardownA();

      expect(dashboardMutationApi.isAvailable()).toBe(true);

      teardownB();

      expect(dashboardMutationApi.isAvailable()).toBe(false);
    });

    it('does not report the API as gone when a superseded scene deactivates', () => {
      const listener = jest.fn();
      const unsubscribe = dashboardMutationApi.onAvailabilityChange(listener);

      const teardownA = createMutationClient(sceneA);
      const teardownB = createMutationClient(sceneB);
      // Both loads notify, the second because commands now dispatch against B.
      expect(listener.mock.calls).toEqual([[true], [true]]);
      listener.mockClear();

      teardownA();

      expect(listener).not.toHaveBeenCalled();

      teardownB();

      expect(listener.mock.calls).toEqual([[false]]);
      unsubscribe();
    });
  });

  describe('security: no scene leakage', () => {
    it('should not expose mutation client on window', () => {
      const client = createMockClient();
      setDashboardMutationClientForTests(client);

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- checking window global doesn't leak
      expect((window as Record<string, unknown>).__grafanaDashboardMutationAPI).toBeUndefined();
    });
  });
});
