import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { DashboardMutationClient } from 'app/features/dashboard-scene/mutation-api/DashboardMutationClient';
import type { MutationClient, MutationRequest, MutationResult } from 'app/features/dashboard-scene/mutation-api/types';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';
import { NotebookMutationClient } from 'app/features/notebook/mutation-api/NotebookMutationClient';
import type { NotebookScene } from 'app/features/notebook/scene/NotebookScene';

import { allMutationCommands } from './commandRegistry';
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
  };
}

describe('dashboardMutationApi', () => {
  afterEach(() => {
    setDashboardMutationClientForTests(null);
    setTestFlags({});
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
      for (const cmd of allMutationCommands()) {
        const schema = dashboardMutationApi.getPayloadSchema(cmd.name);
        expect(schema).toBeDefined();
        expect(typeof schema!.safeParse).toBe('function');
      }
    });

    it('returns null for unknown commands', () => {
      expect(dashboardMutationApi.getPayloadSchema('UNKNOWN_COMMAND')).toBeNull();
    });

    it('answers for a notebook command only when notebooks are enabled', () => {
      // Both this and getAvailableCommands() are discovery surfaces, and DashboardMutationClient
      // already keeps CREATE_NOTEBOOK_SPEC out of the second one when the flag is off. A schema for a
      // command that cannot run anywhere on this instance is a tool an agent builds and never uses.
      expect(dashboardMutationApi.getPayloadSchema('GET_NOTEBOOK_SPEC')).toBeNull();

      setTestFlags({ [FlagKeys.DashboardNotebooks]: true });

      expect(dashboardMutationApi.getPayloadSchema('GET_NOTEBOOK_SPEC')).toBeDefined();
    });

    it('is case-insensitive', () => {
      for (const cmd of allMutationCommands()) {
        const lower = dashboardMutationApi.getPayloadSchema(cmd.name.toLowerCase());
        const upper = dashboardMutationApi.getPayloadSchema(cmd.name.toUpperCase());
        expect(lower).toBe(upper);
        expect(lower).toBeDefined();
      }
    });

    it('returns the same schema as the command registry', () => {
      for (const cmd of allMutationCommands()) {
        const schema = dashboardMutationApi.getPayloadSchema(cmd.name);
        expect(schema).toBe(cmd.payloadSchema);
      }
    });

    it('answers for every command a real client exposes', () => {
      // There are two notions of "all commands": this union, and what each client actually registers.
      // They can drift, because a client may add a command at its own seam rather than through a
      // resource registry — DashboardMutationClient does exactly that with CREATE_NOTEBOOK_SPEC. A name
      // a caller can see on `getAvailableCommands()` but cannot get a schema for is the failure, so
      // check against the clients rather than against the union that is being verified.
      setTestFlags({ [FlagKeys.DashboardNotebooks]: true });

      const exposed = [
        ...new DashboardMutationClient(
          new DashboardScene({
            title: 'Dash',
            uid: 'dash-1',
            meta: { canEdit: true },
            body: DefaultGridLayoutManager.fromVizPanels([]),
          })
        ).getAvailableCommands(),
        // getAvailableCommands reads nothing off the scene — the command list is fixed at construction
        // — so a notebook does not have to be built to ask a notebook client what it offers.
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the client only stores the scene; nothing here touches it
        ...new NotebookMutationClient({} as NotebookScene).getAvailableCommands(),
      ];

      expect(exposed).toContain('CREATE_NOTEBOOK_SPEC');
      for (const name of exposed) {
        expect(dashboardMutationApi.getPayloadSchema(name)).not.toBeNull();
      }
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
