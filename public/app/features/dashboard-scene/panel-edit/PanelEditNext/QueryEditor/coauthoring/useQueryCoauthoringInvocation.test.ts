import { act, renderHook, waitFor } from '@testing-library/react';

import { type QueryEditorCoauthoringAdapterV1 } from './internalCoauthoringContract';
import { useQueryCoauthoringInvocation } from './useQueryCoauthoringInvocation';

const invocation = {
  baseline: { refId: 'A' },
  context: {
    revision: '1',
    query: 'up',
    focusRanges: [{ from: 0, to: 2 }],
    language: { id: 'promql', displayName: 'PromQL' },
    metadata: [],
  },
};

function setup(isAssistantAvailable = false) {
  const adapter = {
    getSnapshot: () => ({ mode: 'hidden' as const }),
    subscribe: () => () => undefined,
    invoke: jest.fn(),
    readInvocation: jest.fn().mockResolvedValue(invocation),
    prepareProposal: jest.fn(),
    dismiss: jest.fn(),
  } satisfies QueryEditorCoauthoringAdapterV1;
  const onBaseline = jest.fn(() => true);
  const hook = renderHook(() =>
    useQueryCoauthoringInvocation({ adapter, invocationId: '1', isAssistantAvailable, onBaseline })
  );
  return { ...hook, adapter, onBaseline };
}

describe('useQueryCoauthoringInvocation', () => {
  it('reads and synchronizes context on demand when Assistant preloading was skipped', async () => {
    const { result, adapter, onBaseline } = setup();

    await act(async () => {
      await expect(result.current.readContext()).resolves.toEqual(invocation.context);
    });

    expect(adapter.readInvocation.mock.calls).toEqual([['1']]);
    expect(onBaseline.mock.calls).toEqual([[{ refId: 'A' }]]);
  });

  it.each([
    {
      name: 'a rejected baseline',
      revision: '1',
      acceptsBaseline: false,
      error: 'The query coauthoring baseline is no longer current.',
    },
    {
      name: 'a different revision',
      revision: 'stale',
      acceptsBaseline: true,
      error: 'The query coauthoring invocation revision does not match the requested invocation.',
    },
  ])(
    'reports $name during an on-demand read and recovers when context is reloaded',
    async ({ revision, acceptsBaseline, error }) => {
      const { result, adapter, onBaseline } = setup();
      adapter.readInvocation.mockResolvedValueOnce({ ...invocation, context: { ...invocation.context, revision } });
      onBaseline.mockReturnValueOnce(acceptsBaseline);
      await act(async () => {
        await expect(result.current.readContext()).rejects.toThrow(error);
      });
      expect(result.current.contextError).toBe(true);
      onBaseline.mockReturnValue(true);

      act(() => result.current.loadContext());

      await waitFor(() => expect(result.current.context).toEqual(invocation.context));
      expect(result.current.contextError).toBe(false);
      await expect(result.current.readContext()).resolves.toEqual(invocation.context);
      expect(adapter.readInvocation).toHaveBeenCalledTimes(2);
    }
  );

  it('shares a pending preload with an on-demand context read', async () => {
    const { result, adapter, onBaseline } = setup();
    let resolve!: (value: typeof invocation) => void;
    adapter.readInvocation.mockReturnValueOnce(
      new Promise<typeof invocation>((next) => {
        resolve = next;
      })
    );
    act(() => result.current.loadContext());
    const context = result.current.readContext();

    await act(async () => {
      resolve(invocation);
      await expect(context).resolves.toEqual(invocation.context);
    });

    expect(result.current.context).toEqual(invocation.context);
    expect(adapter.readInvocation.mock.calls).toEqual([['1']]);
    expect(onBaseline.mock.calls).toEqual([[{ refId: 'A' }]]);
  });

  it('keeps newly loaded context when a cleared on-demand read completes late', async () => {
    const { result, adapter, onBaseline } = setup();
    let resolve!: (value: typeof invocation) => void;
    adapter.readInvocation.mockReturnValueOnce(
      new Promise<typeof invocation>((next) => {
        resolve = next;
      })
    );
    const context = result.current.readContext();
    act(() => {
      result.current.clear();
      result.current.loadContext();
    });
    await waitFor(() => expect(result.current.context).toEqual(invocation.context));

    await act(async () => {
      resolve({ ...invocation, baseline: { refId: 'B' } });
      await expect(context).rejects.toThrow(Error);
    });

    expect(result.current.context).toEqual(invocation.context);
    expect(result.current.contextError).toBe(false);
    expect(onBaseline.mock.calls).toEqual([[{ refId: 'A' }]]);
  });
});
