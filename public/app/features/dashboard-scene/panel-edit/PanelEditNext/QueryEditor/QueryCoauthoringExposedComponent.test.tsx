import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type QueryEditorCoauthoringContextV1,
  type QueryEditorCoauthoringControllerV1,
  type QueryEditorCoauthoringV1Props,
} from '@grafana/data';

import { QueryCoauthoringHostProvider } from './QueryCoauthoringHostContext';
import { QueryCoauthoringExposedComponent } from './QueryCoauthoringExposedComponent';

jest.mock('@grafana/assistant', () => ({
  createTool: jest.fn(),
  useAssistant: () => ({ isLoading: false, isAvailable: false }),
  useInlineAssistant: () => ({ generate: jest.fn(), isGenerating: false, cancel: jest.fn(), reset: jest.fn() }),
}));

function createController(portalTarget: HTMLElement): jest.Mocked<QueryEditorCoauthoringControllerV1> {
  const snapshot = { mode: 'selection', selectedText: 'rate', revision: 'revision-1' } as const;
  const context: QueryEditorCoauthoringContextV1 = {
    queryKey: 'prometheus:A',
    revision: 'revision-1',
    query: 'rate(http_requests_total[5m])',
    focusRanges: [{ from: 0, to: 4 }],
    language: { id: 'promql', displayName: 'PromQL' },
    metricMetadata: [],
  };

  return {
    getSnapshot: jest.fn(() => snapshot),
    subscribe: jest.fn((_listener: VoidFunction) => jest.fn()),
    getPortalTarget: jest.fn(() => portalTarget),
    begin: jest.fn().mockResolvedValue(context),
    refreshContext: jest.fn().mockResolvedValue(context),
    stageEditorDiff: jest.fn((_source: string) => ({ status: 'rejected', reason: 'unchanged' })),
    clearEditorDiff: jest.fn(),
    focus: jest.fn(),
    dismiss: jest.fn(),
    dispose: jest.fn(),
  };
}

describe('QueryCoauthoringExposedComponent', () => {
  it('uses the factory behind the extension wrapper, portals Core controls, and disposes a replaced controller', async () => {
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const firstController = createController(portalTarget);
    const secondController = createController(portalTarget);
    const onSurfaceStateChange = jest.fn();
    const host = {
      queryKey: 'prometheus:A',
      preview: jest.fn(),
      accept: jest.fn(),
      revert: jest.fn(),
    };
    const firstProps: QueryEditorCoauthoringV1Props = {
      surfaceGeneration: 'generation-1',
      createController: () => firstController,
      onSurfaceStateChange,
    };

    const view = render(
      <QueryCoauthoringHostProvider value={host}>
        <QueryCoauthoringExposedComponent {...firstProps} />
      </QueryCoauthoringHostProvider>
    );

    expect(onSurfaceStateChange).toHaveBeenCalledWith({ generation: 'generation-1', state: 'ready' });
    expect(within(portalTarget).getByRole('button', { name: 'Copy' })).toBeVisible();

    await userEvent.setup().click(within(portalTarget).getByRole('button', { name: 'Coauthor' }));

    await waitFor(() => expect(firstController.begin).toHaveBeenCalled());
    expect(screen.getByText('Assistant is not available')).toBeVisible();

    await act(async () => {
      view.rerender(
        <QueryCoauthoringHostProvider value={host}>
          <QueryCoauthoringExposedComponent {...firstProps} createController={() => secondController} />
        </QueryCoauthoringHostProvider>
      );
    });

    expect(firstController.dispose).toHaveBeenCalledTimes(1);
    expect(secondController.getPortalTarget).toHaveBeenCalled();
  });

  it('fails closed when the exposed surface throws after construction', async () => {
    const portalTarget = document.createElement('div');
    const controller = createController(portalTarget);
    controller.getPortalTarget.mockImplementation(() => {
      throw new Error('Portal target disappeared');
    });
    const onSurfaceStateChange = jest.fn();
    const host = { queryKey: 'prometheus:A', preview: jest.fn(), accept: jest.fn(), revert: jest.fn() };
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    try {
      render(
        <QueryCoauthoringHostProvider value={host}>
          <QueryCoauthoringExposedComponent
            surfaceGeneration="generation-1"
            createController={() => controller}
            onSurfaceStateChange={onSurfaceStateChange}
          />
        </QueryCoauthoringHostProvider>
      );

      await waitFor(() =>
        expect(onSurfaceStateChange).toHaveBeenLastCalledWith({ generation: 'generation-1', state: 'failed' })
      );
      expect(controller.clearEditorDiff).toHaveBeenCalledTimes(1);
      expect(controller.dispose).toHaveBeenCalledTimes(1);
      expect(host.revert).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});
