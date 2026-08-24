import { act, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type QueryEditorCoauthoringContextV1,
  type QueryEditorCoauthoringControllerV1,
  type QueryEditorCoauthoringSnapshotV1,
} from '@grafana/data';

import { QueryCoauthoringExposedComponent } from './QueryCoauthoringExposedComponent';
import { QueryCoauthoringHostProvider } from './QueryCoauthoringHostContext';

const mockGenerate = jest.fn().mockResolvedValue(undefined);
const mockCancel = jest.fn();
const mockReset = jest.fn();
let mockAssistantAvailable = false;

jest.mock('@grafana/assistant', () => ({
  createTool: jest.fn(),
  useAssistant: () => ({ isLoading: false, isAvailable: mockAssistantAvailable }),
  useInlineAssistant: () => ({
    generate: mockGenerate,
    isGenerating: false,
    cancel: mockCancel,
    reset: mockReset,
  }),
}));

const context: QueryEditorCoauthoringContextV1 = {
  revision: 'revision-1',
  query: 'rate(http_requests_total[5m])',
  focusRanges: [{ from: 0, to: 4 }],
  language: { id: 'promql', displayName: 'PromQL' },
  metadata: [],
};

function createController(portalTarget: HTMLElement): jest.Mocked<QueryEditorCoauthoringControllerV1> {
  const snapshot = { mode: 'selection' as const, selectedText: 'rate', revision: 'revision-1' };

  return {
    getSnapshot: jest.fn(() => snapshot),
    subscribe: jest.fn((_listener: VoidFunction) => jest.fn()),
    getPortalTarget: jest.fn(() => portalTarget),
    reportSurfaceSize: jest.fn(),
    begin: jest.fn().mockResolvedValue(context),
    refreshContext: jest.fn().mockResolvedValue(context),
    getQueryText: jest.fn(() => context.query),
    stageEditorDiff: jest.fn((_source: string) => ({ status: 'rejected', reason: 'unchanged' })),
    clearEditorDiff: jest.fn(),
    focus: jest.fn(),
    dismiss: jest.fn(),
  };
}

function createStatefulController(portalTarget: HTMLElement) {
  const controller = createController(portalTarget);
  const listeners = new Set<VoidFunction>();
  let snapshot: QueryEditorCoauthoringSnapshotV1 = {
    mode: 'selection',
    selectedText: 'rate',
    revision: context.revision,
  };
  const publish = (nextSnapshot: QueryEditorCoauthoringSnapshotV1) => {
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener());
  };
  const showSelection = () => publish({ mode: 'selection', selectedText: 'rate', revision: context.revision });

  controller.getSnapshot.mockImplementation(() => snapshot);
  controller.subscribe.mockImplementation((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  controller.begin.mockImplementation(() => {
    publish({ mode: 'session', revision: context.revision });
    return Promise.resolve(context);
  });
  controller.dismiss.mockImplementation(() => publish({ mode: 'hidden' }));

  return { controller, showSelection };
}

function createHost() {
  return {
    datasourceType: 'prometheus',
    previewPhase: 'idle' as const,
    timeRange: { from: 1_000, to: 2_000 },
    preview: jest.fn(() => true),
    accept: jest.fn(() => true),
    revert: jest.fn(),
  };
}

describe('QueryCoauthoringExposedComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssistantAvailable = false;
  });

  it('uses the factory and portals the Core-owned selection controls', async () => {
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const controller = createController(portalTarget);

    render(
      <QueryCoauthoringHostProvider value={createHost()}>
        <QueryCoauthoringExposedComponent createController={() => controller} />
      </QueryCoauthoringHostProvider>
    );

    const action = within(portalTarget).getByRole('button', { name: /Explain or modify/ });
    expect(action).toBeVisible();
    expect(action).toHaveTextContent(/[⌘]|ctrl/);
    await userEvent.setup().click(action);
    expect(controller.begin).toHaveBeenCalledTimes(1);
  });

  it('does not dispose a datasource-owned controller when the Core surface unmounts', () => {
    const portalTarget = document.createElement('div');
    const controller = createController(portalTarget);
    const view = render(
      <QueryCoauthoringHostProvider value={createHost()}>
        <QueryCoauthoringExposedComponent createController={() => controller} />
      </QueryCoauthoringHostProvider>
    );

    view.unmount();
    expect(controller.clearEditorDiff).not.toHaveBeenCalled();
  });

  it('does not carry the iteration nudge across dismissed sessions', async () => {
    mockAssistantAvailable = true;
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const { controller, showSelection } = createStatefulController(portalTarget);
    const user = userEvent.setup();

    render(
      <QueryCoauthoringHostProvider value={createHost()}>
        <QueryCoauthoringExposedComponent createController={() => controller} />
      </QueryCoauthoringHostProvider>
    );

    for (let invocation = 0; invocation < 3; invocation++) {
      await user.click(within(portalTarget).getByRole('button', { name: /Explain or modify/ }));
      await within(portalTarget).findByRole('button', { name: 'Close coauthoring' });
      expect(within(portalTarget).queryByText(/Working on something big/)).not.toBeInTheDocument();

      if (invocation < 2) {
        await user.click(within(portalTarget).getByRole('button', { name: 'Close coauthoring' }));
        act(showSelection);
        await within(portalTarget).findByRole('button', { name: /Explain or modify/ });
      }
    }
  });

  it('clears datasource and host preview state when the exposed surface throws', async () => {
    const controller = createController(document.createElement('div'));
    controller.getPortalTarget.mockImplementation(() => {
      throw new Error('Portal target disappeared');
    });
    const host = createHost();
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    try {
      render(
        <QueryCoauthoringHostProvider value={host}>
          <QueryCoauthoringExposedComponent createController={() => controller} />
        </QueryCoauthoringHostProvider>
      );

      await waitFor(() => {
        expect(controller.clearEditorDiff).toHaveBeenCalledTimes(1);
        expect(host.revert).toHaveBeenCalledTimes(1);
        expect(controller.dismiss).toHaveBeenCalledTimes(1);
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it('fails closed when the datasource controller factory throws', async () => {
    const host = createHost();
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    try {
      render(
        <QueryCoauthoringHostProvider value={host}>
          <QueryCoauthoringExposedComponent
            createController={() => {
              throw new Error('Controller could not be created');
            }}
          />
        </QueryCoauthoringHostProvider>
      );

      await waitFor(() => expect(host.revert).toHaveBeenCalledTimes(1));
    } finally {
      consoleError.mockRestore();
    }
  });
});
