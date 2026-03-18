import { isExtractionSuppressed, unsuppressExtraction } from './opExtractor';
import { applyRemoteOp } from './opApplicator';
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
    await applyRemoteOp(msg, client as any, 'local-user');
    expect(isExtractionSuppressed()).toBe(false);
  });

  it('unsuppresses extraction even if execute throws', async () => {
    const client = makeMutationClient({
      execute: jest.fn().mockRejectedValue(new Error('boom')),
    });

    const msg = makeServerMessage();

    await expect(applyRemoteOp(msg, client as any, 'local-user')).rejects.toThrow('boom');
    expect(isExtractionSuppressed()).toBe(false);
  });

  it('skips ops from the local user (already applied)', async () => {
    const client = makeMutationClient();
    const msg = makeServerMessage({ userId: 'local-user' });

    const result = await applyRemoteOp(msg, client as any, 'local-user');

    expect(result.applied).toBe(false);
    expect(client.execute).not.toHaveBeenCalled();
  });

  it('skips non-op messages (lock, checkpoint, presence)', async () => {
    const client = makeMutationClient();

    for (const kind of ['lock', 'checkpoint', 'presence'] as const) {
      const msg = makeServerMessage({ kind });
      const result = await applyRemoteOp(msg, client as any, 'local-user');
      expect(result.applied).toBe(false);
    }

    expect(client.execute).not.toHaveBeenCalled();
  });

  it('returns error when op payload is missing mutation field', async () => {
    const client = makeMutationClient();
    const msg = makeServerMessage({ op: {} });

    const result = await applyRemoteOp(msg, client as any, 'local-user');

    expect(result.applied).toBe(false);
    expect(result.error).toContain('missing mutation field');
    expect(client.execute).not.toHaveBeenCalled();
  });

  it('returns error when op is null', async () => {
    const client = makeMutationClient();
    const msg = makeServerMessage({ op: null as any });

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

    const result = await applyRemoteOp(msg, client as any, 'local-user');

    expect(result.applied).toBe(true);
    expect(client.execute).toHaveBeenCalledWith({
      type: 'UPDATE_DASHBOARD_INFO',
      payload: { title: 'Remote Title', tags: ['collab'] },
    });
  });
});
