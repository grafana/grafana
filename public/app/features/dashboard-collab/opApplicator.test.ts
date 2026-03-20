import type { MutationClient, MutationResult, MutationRequest } from 'app/features/dashboard-scene/mutation-api/types';

import { CollabMutationClient } from './CollabMutationClient';
import { applyRemoteOp } from './opApplicator';
import { isExtractionSuppressed, unsuppressExtraction } from './opExtractor';
import type { ServerMessage, CollabOperation } from './protocol/messages';

function makeMutationClient(overrides: Partial<MockClient> = {}): MockClient {
  return {
    execute: jest.fn().mockResolvedValue({ success: true, changes: [] }),
    getAvailableCommands: jest.fn().mockReturnValue([
      'UPDATE_PANEL',
      'UPDATE_DASHBOARD_INFO',
      'MOVE_PANEL',
      'ADD_PANEL',
      'REMOVE_PANEL',
    ]),
    ...overrides,
  };
}

interface MockClient {
  execute: jest.Mock;
  getAvailableCommands: jest.Mock;
}

function makeServerMessage(overrides: Partial<ServerMessage> = {}): ServerMessage {
  const collabOp: CollabOperation = {
    mutation: { type: 'UPDATE_PANEL', payload: { panelId: 'panel-1', title: 'Remote Title' } },
    lockTarget: 'panel-1',
  };
  return {
    seq: 1,
    kind: 'op',
    op: collabOp,
    userId: 'remote-user',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('opApplicator', () => {
  afterEach(() => {
    unsuppressExtraction();
  });

  it('applies a remote op via DashboardMutationClient', async () => {
    const client = makeMutationClient();
    const msg = makeServerMessage();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyRemoteOp(msg, client as any, 'local-user');

    expect(result.applied).toBe(true);
    expect(client.execute).toHaveBeenCalledWith({
      type: 'UPDATE_PANEL',
      payload: { panelId: 'panel-1', title: 'Remote Title' },
    });
  });

  it('suppresses extraction during application to prevent echo loops', async () => {
    const client = makeMutationClient({
      execute: jest.fn().mockImplementation(async () => {
        // During execution, extraction should be suppressed
        expect(isExtractionSuppressed()).toBe(true);
        return { success: true, changes: [] };
      }),
    });

    const msg = makeServerMessage();

    expect(isExtractionSuppressed()).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await applyRemoteOp(msg, client as any, 'local-user');
    expect(isExtractionSuppressed()).toBe(false);
  });

  it('unsuppresses extraction even if execute throws', async () => {
    const client = makeMutationClient({
      execute: jest.fn().mockRejectedValue(new Error('boom')),
    });

    const msg = makeServerMessage();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(applyRemoteOp(msg, client as any, 'local-user')).rejects.toThrow('boom');
    expect(isExtractionSuppressed()).toBe(false);
  });

  it('skips ops from the local user (already applied)', async () => {
    const client = makeMutationClient();
    const msg = makeServerMessage({ userId: 'local-user' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyRemoteOp(msg, client as any, 'local-user');

    expect(result.applied).toBe(false);
    expect(client.execute).not.toHaveBeenCalled();
  });

  it('skips non-op messages (lock, checkpoint, presence)', async () => {
    const client = makeMutationClient();

    for (const kind of ['lock', 'checkpoint', 'presence'] as const) {
      const msg = makeServerMessage({ kind });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyRemoteOp(msg, client as any, 'local-user');
      expect(result.applied).toBe(false);
    }

    expect(client.execute).not.toHaveBeenCalled();
  });

  it('returns error when op payload is missing mutation field', async () => {
    const client = makeMutationClient();
    const msg = makeServerMessage({ op: {} });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyRemoteOp(msg, client as any, 'local-user');

    expect(result.applied).toBe(false);
    expect(result.error).toContain('missing mutation field');
    expect(client.execute).not.toHaveBeenCalled();
  });

  it('returns error when op is null', async () => {
    const client = makeMutationClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = makeServerMessage({ op: null as any });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyRemoteOp(msg, client as any, 'local-user');

    expect(result.applied).toBe(false);
    expect(result.error).toContain('missing mutation field');
  });

  it('ignores unknown mutation types for forward compatibility', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const client = makeMutationClient();
    const collabOp: CollabOperation = {
      mutation: { type: 'FUTURE_COMMAND', payload: {} },
      lockTarget: 'panel-1',
    };
    const msg = makeServerMessage({ op: collabOp });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyRemoteOp(msg, client as any, 'local-user');

    expect(result.applied).toBe(false);
    expect(result.error).toBeUndefined();
    expect(client.execute).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('FUTURE_COMMAND'));

    warnSpy.mockRestore();
  });

  it('returns error when DashboardMutationClient.execute fails', async () => {
    const client = makeMutationClient({
      execute: jest.fn().mockResolvedValue({
        success: false,
        error: 'Panel not found',
        changes: [],
      }),
    });

    const msg = makeServerMessage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyRemoteOp(msg, client as any, 'local-user');

    expect(result.applied).toBe(false);
    expect(result.error).toBe('Panel not found');
  });

  it('applies UPDATE_DASHBOARD_INFO from remote', async () => {
    const client = makeMutationClient();
    const collabOp: CollabOperation = {
      mutation: {
        type: 'UPDATE_DASHBOARD_INFO',
        payload: { title: 'Remote Title', tags: ['collab'] },
      },
      lockTarget: '__dashboard__',
    };
    const msg = makeServerMessage({ op: collabOp });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await applyRemoteOp(msg, client as any, 'local-user');

    expect(result.applied).toBe(true);
    expect(client.execute).toHaveBeenCalledWith({
      type: 'UPDATE_DASHBOARD_INFO',
      payload: { title: 'Remote Title', tags: ['collab'] },
    });
  });

  describe('echo loop prevention with CollabMutationClient', () => {
    function makeInnerClient(): MutationClient {
      return {
        execute: jest.fn<Promise<MutationResult>, [MutationRequest]>().mockResolvedValue({
          success: true,
          changes: [],
        }),
        getAvailableCommands: jest.fn().mockReturnValue([
          'UPDATE_PANEL',
          'UPDATE_DASHBOARD_INFO',
          'MOVE_PANEL',
          'ADD_PANEL',
          'REMOVE_PANEL',
        ]),
      };
    }

    it('sets remoteApply on CollabMutationClient to prevent re-broadcast', async () => {
      const innerClient = makeInnerClient();
      const publishOp = jest.fn();
      const collabClient = new CollabMutationClient(innerClient, publishOp, 'local-user');

      const msg = makeServerMessage();
      await applyRemoteOp(msg, collabClient, 'local-user');

      // The inner client should have been called (remote op applied)
      expect(innerClient.execute).toHaveBeenCalled();
      // But publishOp should NOT have been called (no re-broadcast)
      expect(publishOp).not.toHaveBeenCalled();
    });

    it('clears remoteApply after application so local edits still broadcast', async () => {
      const innerClient = makeInnerClient();
      const publishOp = jest.fn();
      const collabClient = new CollabMutationClient(innerClient, publishOp, 'local-user');

      // Apply remote op
      const msg = makeServerMessage();
      await applyRemoteOp(msg, collabClient, 'local-user');
      expect(publishOp).not.toHaveBeenCalled();

      // Now a local edit should broadcast
      await collabClient.execute({ type: 'UPDATE_PANEL', payload: {} });
      expect(publishOp).toHaveBeenCalledTimes(1);
    });

    it('clears remoteApply even if inner execute throws', async () => {
      const innerClient: MutationClient = {
        execute: jest.fn().mockRejectedValue(new Error('boom')),
        getAvailableCommands: jest.fn().mockReturnValue(['UPDATE_PANEL']),
      };
      const publishOp = jest.fn();
      const collabClient = new CollabMutationClient(innerClient, publishOp, 'local-user');

      const msg = makeServerMessage();
      await expect(applyRemoteOp(msg, collabClient, 'local-user')).rejects.toThrow('boom');

      // After error, local edits should still broadcast (remoteApply cleared)
      (innerClient.execute as jest.Mock).mockResolvedValue({ success: true, changes: [] });
      await collabClient.execute({ type: 'UPDATE_PANEL', payload: {} });
      expect(publishOp).toHaveBeenCalledTimes(1);
    });
  });
});
