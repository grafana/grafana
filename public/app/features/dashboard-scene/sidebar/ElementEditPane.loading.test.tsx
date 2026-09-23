import { act, render, screen, waitFor } from 'test/test-utils';

import { type SceneComponentProps } from '@grafana/scenes';
import { ErrorBoundary } from '@grafana/ui';

import { ElementEditPane } from './ElementEditPane';
import { type ElementEditPaneRenderer } from './ElementEditPaneRenderer';

type RendererModule = { ElementEditPaneRenderer: typeof ElementEditPaneRenderer };

let mockRendererPromise: Promise<RendererModule>;

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
  ElementEditPaneRenderer: ({ model }: SceneComponentProps<ElementEditPane>) => <div>Editing {model.state.key}</div>,
};

describe('ElementEditPane loading', () => {
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

  it('can reopen after closing while the renderer is loading', async () => {
    const deferred = deferRenderer();
    const closed = new ElementEditPane({ key: 'closed' });
    const { unmount } = render(<closed.Component model={closed} />);
    unmount();

    await act(async () => deferred.resolve(rendererModule));

    const reopened = new ElementEditPane({ key: 'reopened' });
    render(<reopened.Component model={reopened} />);

    expect(await screen.findByText('Editing reopened')).toBeInTheDocument();
    expect(screen.queryByText('Editing closed')).not.toBeInTheDocument();
  });

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
