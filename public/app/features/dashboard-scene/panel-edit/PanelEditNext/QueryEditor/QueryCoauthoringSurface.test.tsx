import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { QueryCoauthoringHostProvider } from './QueryCoauthoringHostContext';
import { QueryCoauthoringSurface } from './QueryCoauthoringSurface';
import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringSnapshotV1,
} from './internalCoauthoringContract';

let mockThrowSessionRender = false;

jest.mock('./QueryCoauthoring', () => ({
  QueryCoauthoring: ({ invocationId }: { invocationId: string }) => {
    if (mockThrowSessionRender) {
      throw new Error('session render failed');
    }
    return <div data-testid="query-coauthoring-session">{invocationId}</div>;
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
    <QueryCoauthoringHostProvider
      value={{
        datasourceType: 'prometheus',
        previewPhase: 'idle',
        preview: jest.fn(() => true),
        accept: jest.fn(() => true),
        revert,
      }}
    >
      <QueryCoauthoringSurface adapter={adapter} onBaseline={jest.fn(() => true)} />
    </QueryCoauthoringHostProvider>
  );
  return { revert, ...view };
}

describe('QueryCoauthoringSurface', () => {
  afterEach(() => {
    mockThrowSessionRender = false;
  });

  it('renders the Core toolbar in the editor-provided target and invokes the adapter', async () => {
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const { adapter } = createAdapter({ mode: 'selection', portalTarget });
    const user = userEvent.setup();

    renderSurface(adapter);

    await user.click(screen.getByRole('button', { name: /Explain or modify/ }));

    expect(adapter.invoke).toHaveBeenCalledTimes(1);
    expect(portalTarget).toContainElement(screen.getByTestId('query-coauthoring-selection-toolbar'));
  });

  it('replaces the toolbar with the Core session when the adapter publishes an invocation', () => {
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const { adapter, publish } = createAdapter({ mode: 'selection', portalTarget });

    renderSurface(adapter);
    act(() => publish({ mode: 'invoked', invocationId: 'invocation-1', portalTarget }));

    expect(screen.queryByTestId('query-coauthoring-selection-toolbar')).not.toBeInTheDocument();
    expect(screen.getByTestId('query-coauthoring-session')).toHaveTextContent('invocation-1');
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

      expect(nextTarget).toContainElement(screen.getByTestId('query-coauthoring-selection-toolbar'));
    } finally {
      consoleError.mockRestore();
    }
  });
});
