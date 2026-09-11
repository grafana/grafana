import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState as mockUseState } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { QueryCoauthoringSurface } from './QueryCoauthoringSurface';
import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringSnapshotV1,
} from './internalCoauthoringContract';

let mockThrowSessionRender = false;
let mockSessionInstanceId = 0;

jest.mock('./QueryCoauthoring', () => ({
  QueryCoauthoring: ({ invocationId }: { invocationId: string }) => {
    const [instanceId] = mockUseState(() => ++mockSessionInstanceId);
    if (mockThrowSessionRender) {
      throw new Error('session render failed');
    }
    return <div data-testid="query-coauthoring-session">{`${invocationId}:${instanceId}`}</div>;
  },
}));

function createAdapter(initialSnapshot: QueryEditorCoauthoringSnapshotV1) {
  let snapshot = initialSnapshot;
  const listeners = new Set<VoidFunction>();
  const adapter: QueryEditorCoauthoringAdapterV1 = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    invoke: jest.fn(),
    readInvocation: jest.fn(),
    prepareProposal: jest.fn(),
    dismiss: jest.fn(),
  };

  return {
    adapter,
    publish: (nextSnapshot: QueryEditorCoauthoringSnapshotV1) => {
      snapshot = nextSnapshot;
      listeners.forEach((listener) => listener());
    },
  };
}

function renderSurface(adapter: QueryEditorCoauthoringAdapterV1) {
  const revert = jest.fn();
  const view = render(
    <QueryCoauthoringSurface
      adapter={adapter}
      host={{
        datasourceType: 'prometheus',
        previewPhase: 'idle',
        preview: jest.fn(() => true),
        accept: jest.fn(() => true),
        revert,
      }}
      onBaseline={jest.fn(() => true)}
    />
  );
  return { revert, ...view };
}

describe('QueryCoauthoringSurface', () => {
  afterEach(() => {
    mockThrowSessionRender = false;
    mockSessionInstanceId = 0;
  });

  it('renders the Core toolbar in the editor-provided target and invokes the adapter', async () => {
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const { adapter } = createAdapter({ mode: 'selection', portalTarget });
    const user = userEvent.setup();

    renderSurface(adapter);

    await user.click(screen.getByRole('button', { name: /Explain or modify/ }));

    expect(adapter.invoke).toHaveBeenCalledTimes(1);
    expect(portalTarget).toContainElement(
      screen.getByTestId(selectors.components.QueryEditorCoauthoring.selectionToolbar)
    );
  });

  it('replaces the toolbar with the Core session when the adapter publishes an invocation', () => {
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const { adapter, publish } = createAdapter({ mode: 'selection', portalTarget });

    renderSurface(adapter);
    act(() => publish({ mode: 'invoked', invocationId: 'invocation-1', portalTarget }));

    expect(screen.queryByTestId(selectors.components.QueryEditorCoauthoring.selectionToolbar)).not.toBeInTheDocument();
    expect(screen.getByTestId('query-coauthoring-session')).toHaveTextContent('invocation-1:1');
  });

  it('remounts the Core session when the adapter publishes a new invocation', () => {
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const { adapter, publish } = createAdapter({
      mode: 'invoked',
      invocationId: 'invocation-1',
      portalTarget,
    });

    renderSurface(adapter);
    expect(screen.getByTestId('query-coauthoring-session')).toHaveTextContent('invocation-1:1');

    act(() => publish({ mode: 'invoked', invocationId: 'invocation-2', portalTarget }));

    expect(screen.getByTestId('query-coauthoring-session')).toHaveTextContent('invocation-2:2');
  });

  it('recovers when the same adapter publishes a later session after a render failure', () => {
    const firstTarget = document.createElement('div');
    const nextTarget = document.createElement('div');
    document.body.append(firstTarget, nextTarget);
    const { adapter, publish } = createAdapter({
      mode: 'invoked',
      invocationId: 'invocation-1',
      portalTarget: firstTarget,
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockThrowSessionRender = true;

    try {
      const { revert } = renderSurface(adapter);

      expect(revert).toHaveBeenCalledTimes(1);
      expect(adapter.dismiss).toHaveBeenCalledTimes(1);

      mockThrowSessionRender = false;
      act(() => publish({ mode: 'selection', portalTarget: nextTarget }));

      expect(nextTarget).toContainElement(
        screen.getByTestId(selectors.components.QueryEditorCoauthoring.selectionToolbar)
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('contains an initial snapshot failure and recovers after a later publication', () => {
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const { adapter, publish } = createAdapter({ mode: 'hidden' });
    let snapshotReady = false;
    const recoveredSnapshot = { mode: 'selection', portalTarget } as const;
    adapter.getSnapshot = jest.fn(() => {
      if (!snapshotReady) {
        throw new Error('snapshot failed');
      }
      return recoveredSnapshot;
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    try {
      const { revert } = renderSurface(adapter);

      expect(revert).toHaveBeenCalledTimes(1);
      expect(adapter.dismiss).toHaveBeenCalledTimes(1);
      snapshotReady = true;
      act(() => publish({ mode: 'selection', portalTarget }));

      expect(portalTarget).toContainElement(
        screen.getByTestId(selectors.components.QueryEditorCoauthoring.selectionToolbar)
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('contains an adapter subscription failure and recovers after a later publication', () => {
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const { adapter, publish } = createAdapter({ mode: 'hidden' });
    const subscribe = adapter.subscribe;
    adapter.subscribe = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('subscription failed');
      })
      .mockImplementation(subscribe);
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    try {
      const { revert } = renderSurface(adapter);

      expect(revert).toHaveBeenCalledTimes(1);
      expect(adapter.dismiss).toHaveBeenCalledTimes(1);
      act(() => publish({ mode: 'selection', portalTarget }));

      expect(portalTarget).toContainElement(
        screen.getByTestId(selectors.components.QueryEditorCoauthoring.selectionToolbar)
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
