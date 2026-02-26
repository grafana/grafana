import { ALL_COMMANDS } from 'app/features/dashboard-scene/mutation-api';
import type { MutationClient, MutationRequest, MutationResult } from 'app/features/dashboard-scene/mutation-api/types';

import { dashboardMutationApi, setDashboardMutationClient } from './dashboardMutationApi';

function createMockClient(): MutationClient {
  return {
    execute: jest.fn(
      async (_mutation: MutationRequest): Promise<MutationResult> => ({
        success: true,
        changes: [],
      })
    ),
  };
}

describe('dashboardMutationApi', () => {
  afterEach(() => {
    setDashboardMutationClient(null);
  });

  describe('execute', () => {
    it('throws when no client is registered', async () => {
      await expect(dashboardMutationApi.execute({ type: 'LIST_VARIABLES', payload: {} })).rejects.toThrow(
        'Dashboard Mutation API is not available'
      );
    });

    it('delegates to the registered client', async () => {
      const client = createMockClient();
      setDashboardMutationClient(client);

      const result = await dashboardMutationApi.execute({ type: 'LIST_VARIABLES', payload: {} });
      expect(result.success).toBe(true);
      expect(client.execute).toHaveBeenCalledWith({ type: 'LIST_VARIABLES', payload: {} });
    });

    it('throws after client is unregistered', async () => {
      const client = createMockClient();
      setDashboardMutationClient(client);
      setDashboardMutationClient(null);

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

  describe('security: no scene leakage', () => {
    it('should not expose mutation client on window', () => {
      const client = createMockClient();
      setDashboardMutationClient(client);

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- checking window global doesn't leak
      expect((window as Record<string, unknown>).__grafanaDashboardMutationAPI).toBeUndefined();
    });
  });
});
