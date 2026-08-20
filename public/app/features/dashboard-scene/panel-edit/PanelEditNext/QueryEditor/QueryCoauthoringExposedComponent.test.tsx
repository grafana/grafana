import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type QueryEditorCoauthoringContextV1, type QueryEditorCoauthoringControllerV1 } from '@grafana/data';

import { QueryCoauthoringExposedComponent } from './QueryCoauthoringExposedComponent';
import { QueryCoauthoringHostProvider } from './QueryCoauthoringHostContext';

jest.mock('@grafana/assistant', () => ({
  createTool: jest.fn(),
  useAssistant: () => ({ isLoading: false, isAvailable: false }),
  useInlineAssistant: () => ({ generate: jest.fn(), isGenerating: false, cancel: jest.fn(), reset: jest.fn() }),
}));

function createController(portalTarget: HTMLElement): jest.Mocked<QueryEditorCoauthoringControllerV1> {
  const context: QueryEditorCoauthoringContextV1 = {
    revision: 'revision-1',
    query: 'rate(http_requests_total[5m])',
    focusRanges: [{ from: 0, to: 4 }],
    language: { id: 'promql', displayName: 'PromQL' },
    metricMetadata: [],
  };

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

function createHost() {
  return {
    datasourceType: 'prometheus',
    timeRange: { from: 1_000, to: 2_000 },
    preview: jest.fn(() => true),
    accept: jest.fn(() => true),
    revert: jest.fn(),
  };
}

describe('QueryCoauthoringExposedComponent', () => {
  it('uses the factory and portals the Core-owned selection controls', async () => {
    const portalTarget = document.createElement('div');
    document.body.append(portalTarget);
    const controller = createController(portalTarget);

    render(
      <QueryCoauthoringHostProvider value={createHost()}>
        <QueryCoauthoringExposedComponent createController={() => controller} />
      </QueryCoauthoringHostProvider>
    );

    expect(within(portalTarget).getByRole('button', { name: 'Copy' })).toBeVisible();
    await userEvent.setup().click(within(portalTarget).getByRole('button', { name: 'Coauthor' }));
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
