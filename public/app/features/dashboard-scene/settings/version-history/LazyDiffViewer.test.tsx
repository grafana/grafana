import { type PropsWithChildren, Suspense } from 'react';
import { render, screen, waitFor, getWrapper } from 'test/test-utils';

import { createTheme, ThemeContext } from '@grafana/data';

import LazyDiffViewer from './LazyDiffViewer';

const theme = createTheme();

function TestProviders({ children }: PropsWithChildren) {
  const ReduxWrapper = getWrapper({});
  return (
    <ThemeContext.Provider value={theme}>
      <ReduxWrapper>{children}</ReduxWrapper>
    </ThemeContext.Provider>
  );
}

describe('LazyDiffViewer', () => {
  it('resolves the lazy module and renders DiffViewer content', async () => {
    const oldValue = 'lazy-diff-viewer-old-marker';
    const newValue = 'lazy-diff-viewer-new-marker';

    render(
      <Suspense fallback={'Loading...'}>
        <LazyDiffViewer oldValue={oldValue} newValue={newValue} />
      </Suspense>,
      { wrapper: TestProviders }
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(oldValue)).toBeInTheDocument();
    });
    expect(screen.getByText(newValue)).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});
