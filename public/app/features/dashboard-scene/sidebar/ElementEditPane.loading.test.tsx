import * as React from 'react';
import { act, render, screen, waitFor } from 'test/test-utils';

import * as scenes from '@grafana/scenes';
import { type SceneComponentProps } from '@grafana/scenes';
import { ErrorBoundary } from '@grafana/ui';

import { type ElementEditPane as ElementEditPaneModel } from './ElementEditPane';
import { type ElementEditPaneRenderer } from './ElementEditPaneRenderer';

type RendererModule = { ElementEditPaneRenderer: typeof ElementEditPaneRenderer };

let mockRendererPromise: Promise<RendererModule>;
let ElementEditPane: typeof ElementEditPaneModel;

jest.mock('./ElementEditPaneRenderer', () => ({
  __esModule: true,
  // Preserve the deferred import through Jest's module interop.
  get then() {
    return mockRendererPromise.then.bind(mockRendererPromise);
  },
}));

function deferRenderer() {
  let resolve!: (module: RendererModule) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<RendererModule>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  mockRendererPromise = promise;
  return { resolve, reject };
}

const rendererModule = {
  ElementEditPaneRenderer: ({ model }: SceneComponentProps<ElementEditPaneModel>) => (
    <div>Editing {model.state.key}</div>
  ),
};

describe('ElementEditPane loading', () => {
  beforeEach(() => {
    // Reset the renderer cache without creating another React or scenes instance.
    jest.isolateModules(() => {
      jest.doMock('react', () => React);
      jest.doMock('@grafana/scenes', () => scenes);
      ElementEditPane = jest.requireActual('./ElementEditPane').ElementEditPane;
    });
  });

  it('renders nothing while loading, then renders the latest model', async () => {
    const deferred = deferRenderer();
    const original = new ElementEditPane({ key: 'original' });
    const replacement = new ElementEditPane({ key: 'replacement' });
    const { container, rerender } = render(<original.Component model={original} />);

    expect(container).toBeEmptyDOMElement();
    rerender(<replacement.Component model={replacement} />);

    await act(async () => deferred.resolve(rendererModule));

    expect(await screen.findByText('Editing replacement')).toBeInTheDocument();
    expect(screen.queryByText('Editing original')).not.toBeInTheDocument();
  });

  it.each([true, false])(
    'reopens synchronously after loading (closed before completion: %s)',
    async (closeBeforeLoad) => {
      const deferred = deferRenderer();
      const closed = new ElementEditPane({ key: 'closed' });
      const { unmount } = render(<closed.Component model={closed} />);
      if (closeBeforeLoad) {
        unmount();
      }

      await act(async () => deferred.resolve(rendererModule));

      if (!closeBeforeLoad) {
        expect(await screen.findByText('Editing closed')).toBeInTheDocument();
        unmount();
      }

      const reopened = new ElementEditPane({ key: 'reopened' });
      const reopenedView = render(<reopened.Component model={reopened} />);

      try {
        expect(screen.getByText('Editing reopened')).toBeInTheDocument();
        expect(screen.queryByText('Editing closed')).not.toBeInTheDocument();
      } finally {
        reopenedView.unmount();
      }
    }
  );

  it('reports a failed import to the surrounding error boundary', async () => {
    const deferred = deferRenderer();
    const pane = new ElementEditPane({});
    const error = new Error('Failed to load dashboard options');
    const onError = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(
        <ErrorBoundary onError={onError}>
          {({ error }) => (error ? <div role="alert">{error.message}</div> : <pane.Component model={pane} />)}
        </ErrorBoundary>
      );

      await act(async () => deferred.reject(error));

      expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load dashboard options');
      await waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    } finally {
      consoleError.mockRestore();
    }
  });
});
