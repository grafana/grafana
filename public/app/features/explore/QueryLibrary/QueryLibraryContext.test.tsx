import { act, render, screen, waitFor } from '@testing-library/react';
import { ComponentType } from 'react';

import { PromQuery } from '@grafana/prometheus';

import { useQueryLibraryContext, QueryLibraryContextProvider, QueryLibraryContextType } from './QueryLibraryContext';

// Bit of mocking here mainly so we don't have to mock too much of the API calls here and keep this test focused on the
// context state management and correct rendering.

jest.mock('./AddToQueryLibraryModal', () => ({
  __esModule: true,
  AddToQueryLibraryModal: (props: { isOpen: boolean; query: unknown }) =>
    props.isOpen && <div>QUERY_MODAL {JSON.stringify(props.query)}</div>,
}));

jest.mock('./QueryLibraryDrawer', () => ({
  __esModule: true,
  QueryLibraryDrawer: (props: {
    isOpen: boolean;
    activeDatasources: string[] | undefined;
    queryActionButton: ComponentType;
  }) =>
    props.isOpen && (
      <div>
        QUERY_DRAWER {JSON.stringify(props.activeDatasources)} {props.queryActionButton && <props.queryActionButton />}
      </div>
    ),
}));

function setup() {
  let ctx: { current: QueryLibraryContextType | undefined } = { current: undefined };
  function TestComp() {
    ctx.current = useQueryLibraryContext();
    return <div></div>;
  }
  // rendering instead of just using renderHook so we can check if the modal and drawer actually render.
  const renderResult = render(
    <QueryLibraryContextProvider>
      <TestComp />
    </QueryLibraryContextProvider>
  );

  return { ctx, renderResult };
}

describe('QueryLibraryContext', () => {
  it('should not render modal or drawer by default', () => {
    setup();
    // should catch both modal and drawer
    expect(screen.queryByText(/QUERY_MODAL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/QUERY_DRAWER/i)).not.toBeInTheDocument();
  });

  it('should be able to open modal', async () => {
    const { ctx } = setup();
    act(() => {
      ctx.current!.openAddQueryModal({ refId: 'A', expr: 'http_requests_total{job="test"}' } as PromQuery);
    });

    await waitFor(() => {
      expect(screen.queryByText(/QUERY_MODAL/i)).toBeInTheDocument();
      expect(screen.queryByText(/http_requests_total\{job=\\"test\\"}/i)).toBeInTheDocument();
    });
  });

  it('should be able to open drawer', async () => {
    const { ctx } = setup();
    act(() => {
      ctx.current!.openDrawer(['PROM_TEST_DS'], () => <div>QUERY_ACTION_BUTTON</div>);
    });

    await waitFor(() => {
      expect(screen.queryByText(/QUERY_DRAWER/i)).toBeInTheDocument();
      expect(screen.queryByText(/PROM_TEST_DS/i)).toBeInTheDocument();
      expect(screen.queryByText(/QUERY_ACTION_BUTTON/i)).toBeInTheDocument();
    });
  });
});
