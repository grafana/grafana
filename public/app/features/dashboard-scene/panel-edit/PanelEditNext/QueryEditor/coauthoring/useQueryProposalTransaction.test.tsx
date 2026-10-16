import { act, renderHook } from '@testing-library/react';

import { LoadingState } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { type QueryEditorCoauthoringAdapterV1 } from './internalCoauthoringContract';
import { useQueryProposalTransaction } from './useQueryProposalTransaction';

interface TestQuery extends DataQuery {
  legendFormat: string;
  hide?: boolean;
}

const queryA: TestQuery = { refId: 'A', legendFormat: 'series-a' };
const queryB: TestQuery = { refId: 'B', legendFormat: 'series-b' };
const proposedQuery: TestQuery = { refId: 'A', legendFormat: 'proposed' };

function createAdapter() {
  return {
    getSnapshot: () => ({ mode: 'hidden' as const }),
    subscribe: () => () => undefined,
    invoke: jest.fn(),
    readInvocation: jest.fn(),
    prepareProposal: jest.fn(),
    dismiss: jest.fn(),
  } satisfies QueryEditorCoauthoringAdapterV1;
}

describe('useQueryProposalTransaction', () => {
  it('coordinates preview state, external changes, manual edits, revert, and accept', () => {
    const updateQuery = jest.fn();
    const runQueries = jest.fn();
    const disposePreview = jest.fn();
    let publishPreviewState: ((state: LoadingState) => void) | undefined;
    const startQueryPreview = jest.fn(() => ({
      dispose: disposePreview,
      subscribeToState: (listener: (state: LoadingState) => void) => {
        publishPreviewState = listener;
        return () => undefined;
      },
    }));
    const adapter = createAdapter();
    const initialProps = { query: queryA, queries: [queryA, queryB] };
    const { result, rerender } = renderHook(
      ({ query, queries }: { query: TestQuery; queries: TestQuery[] }) =>
        useQueryProposalTransaction({
          query,
          queries,
          queryKey: 'prometheus:A',
          adapter,
          updateQuery,
          runQueries,
          startQueryPreview,
        }),
      { initialProps }
    );

    act(() => expect(result.current.preview(proposedQuery)).toBe(true));
    expect(result.current.previewPhase).toBe('pending');
    expect(result.current.editorQuery).toEqual(proposedQuery);
    expect(result.current.editorQueries[0]).toEqual(proposedQuery);
    expect(startQueryPreview).toHaveBeenCalledWith('A', proposedQuery);

    act(() => publishPreviewState!(LoadingState.Done));
    expect(result.current.previewPhase).toBe('complete');
    act(() => publishPreviewState!(LoadingState.Loading));
    expect(result.current.previewPhase).toBe('running');

    act(() => result.current.revert());
    expect(result.current.editorQuery).toEqual(queryA);
    expect(disposePreview).toHaveBeenCalledTimes(1);
    expect(runQueries).toHaveBeenCalledTimes(1);
    expect(result.current.accept(proposedQuery)).toBe(false);

    act(() => expect(result.current.preview(proposedQuery)).toBe(true));
    rerender({ query: { ...queryA }, queries: [{ ...queryA }, queryB] });
    expect(result.current.editorQuery).toEqual(proposedQuery);
    expect(disposePreview).toHaveBeenCalledTimes(1);
    expect(adapter.dismiss).not.toHaveBeenCalled();

    const externallyChangedQuery = { ...queryA, hide: true };
    rerender({ query: externallyChangedQuery, queries: [externallyChangedQuery, queryB] });
    expect(result.current.editorQuery).toEqual(externallyChangedQuery);
    expect(disposePreview).toHaveBeenCalledTimes(2);
    expect(adapter.dismiss).toHaveBeenCalledTimes(1);

    rerender(initialProps);
    act(() => expect(result.current.preview(proposedQuery)).toBe(true));
    const externallyChangedSibling = { ...queryB, hide: true };
    rerender({ query: queryA, queries: [queryA, externallyChangedSibling] });
    expect(result.current.editorQuery).toEqual(queryA);
    expect(disposePreview).toHaveBeenCalledTimes(3);
    expect(adapter.dismiss).toHaveBeenCalledTimes(2);

    rerender(initialProps);
    act(() => expect(result.current.preview(proposedQuery)).toBe(true));
    const firstManualEdit = { ...queryA, legendFormat: 'manual' };
    act(() => result.current.onChange(firstManualEdit));
    expect(adapter.dismiss).toHaveBeenCalledTimes(3);
    expect(updateQuery).toHaveBeenLastCalledWith(firstManualEdit, 'A');
    expect(runQueries).toHaveBeenCalledTimes(1);

    const laterManualEdit = { ...queryA, legendFormat: 'manual-later' };
    act(() => result.current.onChange(laterManualEdit));
    expect(updateQuery).toHaveBeenLastCalledWith(laterManualEdit, 'A');
    expect(result.current.accept(proposedQuery)).toBe(false);

    rerender(initialProps);
    act(() => expect(result.current.preview(proposedQuery)).toBe(true));
    act(() => expect(result.current.accept(proposedQuery)).toBe(true));
    expect(updateQuery).toHaveBeenLastCalledWith(proposedQuery, 'A');
    expect(runQueries).toHaveBeenCalledTimes(2);
  });

  it('clears an active transaction before an explicit run and allows another preview', () => {
    const updateQuery = jest.fn();
    const runQueries = jest.fn();
    const adapter = createAdapter();
    const startQueryPreview = jest.fn(() => ({
      dispose: jest.fn(),
      subscribeToState: jest.fn(() => () => undefined),
    }));
    const { result } = renderHook(() =>
      useQueryProposalTransaction({
        query: queryA,
        queries: [queryA, queryB],
        queryKey: 'prometheus:A',
        adapter,
        updateQuery,
        runQueries,
        startQueryPreview,
      })
    );

    act(() => expect(result.current.preview(proposedQuery)).toBe(true));
    act(() => result.current.run());

    expect(result.current.editorQuery).toEqual(queryA);
    expect(adapter.dismiss).toHaveBeenCalledTimes(1);
    expect(runQueries).toHaveBeenCalledTimes(1);
    act(() => expect(result.current.preview(proposedQuery)).toBe(true));
  });
});
