import { CollabMutationClient } from './CollabMutationClient';

import type { MutationClient, MutationRequest, MutationResult } from 'app/features/dashboard-scene/mutation-api/types';
import { isExtractionSuppressed, unsuppressExtraction } from './opExtractor';
import type { ClientMessage } from './protocol/messages';

function makeInnerClient(overrides?: Partial<MutationClient>): MutationClient {
  return {
    execute: jest.fn<Promise<MutationResult>, [MutationRequest]>().mockResolvedValue({
      success: true,
      changes: [{ path: '/title', previousValue: 'old', newValue: 'new' }],
    }),
    getAvailableCommands: jest.fn().mockReturnValue(['UPDATE_PANEL', 'LIST_PANELS', 'GET_LAYOUT']),
    ...overrides,
  };
}

describe('CollabMutationClient', () => {
  let inner: MutationClient;
  let publishOp: jest.Mock<void, [ClientMessage]>;
  let client: CollabMutationClient;

  beforeEach(() => {
    inner = makeInnerClient();
    publishOp = jest.fn();
    client = new CollabMutationClient(inner, publishOp, 'user-1');
  });

  it('delegates execute to the inner client', async () => {
    const mutation: MutationRequest = { type: 'UPDATE_PANEL', payload: { element: { name: 'panel-1' } } };
    const result = await client.execute(mutation);

    expect(inner.execute).toHaveBeenCalledWith(mutation);
    expect(result.success).toBe(true);
  });

  it('broadcasts successful write mutations', async () => {
    const mutation: MutationRequest = {
      type: 'UPDATE_PANEL',
      payload: { element: { kind: 'ElementReference', name: 'panel-1' }, panel: { kind: 'Panel', spec: { title: 'new' } } },
    };
    await client.execute(mutation);

    expect(publishOp).toHaveBeenCalledTimes(1);
    const msg = publishOp.mock.calls[0][0];
    expect(msg.kind).toBe('op');
    expect(msg.op).toMatchObject({
      mutation: { type: 'UPDATE_PANEL', payload: mutation.payload },
      lockTarget: 'panel-1',
      userId: 'user-1',
    });
  });

  it('does not broadcast read-only commands', async () => {
    for (const type of ['LIST_PANELS', 'LIST_VARIABLES', 'GET_LAYOUT', 'GET_DASHBOARD_INFO']) {
      publishOp.mockClear();
      await client.execute({ type, payload: {} });
      expect(publishOp).not.toHaveBeenCalled();
    }
  });

  it('does not broadcast failed mutations', async () => {
    inner = makeInnerClient({
      execute: jest.fn<Promise<MutationResult>, [MutationRequest]>().mockResolvedValue({
        success: false,
        error: 'Something went wrong',
        changes: [],
      }),
    });
    client = new CollabMutationClient(inner, publishOp, 'user-1');

    await client.execute({ type: 'UPDATE_PANEL', payload: {} });
    expect(publishOp).not.toHaveBeenCalled();
  });

  it('does not broadcast when remoteApply flag is set', async () => {
    client.setRemoteApply(true);

    await client.execute({
      type: 'UPDATE_PANEL',
      payload: { element: { kind: 'ElementReference', name: 'panel-1' } },
    });

    expect(inner.execute).toHaveBeenCalled();
    expect(publishOp).not.toHaveBeenCalled();
  });

  it('resumes broadcasting when remoteApply flag is cleared', async () => {
    client.setRemoteApply(true);
    await client.execute({ type: 'UPDATE_PANEL', payload: {} });
    expect(publishOp).not.toHaveBeenCalled();

    client.setRemoteApply(false);
    await client.execute({ type: 'UPDATE_PANEL', payload: {} });
    expect(publishOp).toHaveBeenCalledTimes(1);
  });

  it('delegates getAvailableCommands to the inner client', () => {
    const commands = client.getAvailableCommands();
    expect(commands).toEqual(['UPDATE_PANEL', 'LIST_PANELS', 'GET_LAYOUT']);
    expect(inner.getAvailableCommands).toHaveBeenCalled();
  });

  it('normalizes command type to uppercase for broadcast', async () => {
    await client.execute({
      type: 'update_panel',
      payload: { element: { kind: 'ElementReference', name: 'panel-1' } },
    });

    const msg = publishOp.mock.calls[0][0];
    expect((msg.op as any).mutation.type).toBe('UPDATE_PANEL');
  });

  it('includes correct lockTarget for dashboard-level mutations', async () => {
    await client.execute({
      type: 'UPDATE_DASHBOARD_INFO',
      payload: { title: 'New Title' },
    });

    const msg = publishOp.mock.calls[0][0];
    expect((msg.op as any).lockTarget).toBe('__dashboard__');
  });

  it('includes empty lockTarget for ADD_PANEL', async () => {
    await client.execute({
      type: 'ADD_PANEL',
      payload: {},
    });

    const msg = publishOp.mock.calls[0][0];
    expect((msg.op as any).lockTarget).toBe('');
  });

  describe('opExtractor suppression', () => {
    afterEach(() => {
      unsuppressExtraction();
    });

    it('suppresses opExtractor during write mutation execution', async () => {
      inner = makeInnerClient({
        execute: jest.fn<Promise<MutationResult>, [MutationRequest]>().mockImplementation(async () => {
          expect(isExtractionSuppressed()).toBe(true);
          return { success: true, changes: [] };
        }),
      });
      client = new CollabMutationClient(inner, publishOp, 'user-1');

      expect(isExtractionSuppressed()).toBe(false);
      await client.execute({ type: 'UPDATE_PANEL', payload: {} });
      // Unsuppression is deferred via queueMicrotask to let scene changes settle
      await new Promise<void>((r) => queueMicrotask(r));
      expect(isExtractionSuppressed()).toBe(false);
    });

    it('does not suppress opExtractor for read-only commands', async () => {
      inner = makeInnerClient({
        execute: jest.fn<Promise<MutationResult>, [MutationRequest]>().mockImplementation(async () => {
          expect(isExtractionSuppressed()).toBe(false);
          return { success: true, changes: [] };
        }),
      });
      client = new CollabMutationClient(inner, publishOp, 'user-1');

      await client.execute({ type: 'LIST_PANELS', payload: {} });
      expect(isExtractionSuppressed()).toBe(false);
    });

    it('unsuppresses opExtractor even if inner execute throws', async () => {
      inner = makeInnerClient({
        execute: jest.fn<Promise<MutationResult>, [MutationRequest]>().mockRejectedValue(new Error('boom')),
      });
      client = new CollabMutationClient(inner, publishOp, 'user-1');

      await expect(client.execute({ type: 'UPDATE_PANEL', payload: {} })).rejects.toThrow('boom');
      // Unsuppression is deferred via queueMicrotask
      await new Promise<void>((r) => queueMicrotask(r));
      expect(isExtractionSuppressed()).toBe(false);
    });

    it('does not suppress opExtractor when remoteApply is set', async () => {
      inner = makeInnerClient({
        execute: jest.fn<Promise<MutationResult>, [MutationRequest]>().mockImplementation(async () => {
          // When remoteApply is set, opApplicator handles its own suppression
          expect(isExtractionSuppressed()).toBe(false);
          return { success: true, changes: [] };
        }),
      });
      client = new CollabMutationClient(inner, publishOp, 'user-1');
      client.setRemoteApply(true);

      await client.execute({ type: 'UPDATE_PANEL', payload: {} });
      expect(isExtractionSuppressed()).toBe(false);
    });
  });
});
