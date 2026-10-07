import { isEqual } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LoadingState, type PanelData } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { type QueryEditorCoauthoringAdapterV1 } from './internalCoauthoringContract';
import { type QueryPreview, type QueryPreviewSelection } from './queryPreview';

interface QueryProposalTransactionState {
  baseline: DataQuery;
  baselineQueries: DataQuery[];
  queryKey: string;
}

interface QueryProposalTransactionOptions {
  query: DataQuery | null;
  queries: DataQuery[];
  queryKey: string;
  adapter?: QueryEditorCoauthoringAdapterV1;
  updateQuery: (updatedQuery: DataQuery, originalRefId: string) => void;
  runQueries: VoidFunction;
  startQueryPreview: (originalRefId: string, proposedQuery: DataQuery) => QueryPreview | undefined;
}

export function synchronizeCoauthoringBaselineQuery(
  currentQuery: DataQuery | null | undefined,
  baseline: DataQuery,
  updateQuery: (updatedQuery: DataQuery, originalRefId: string) => void
): boolean {
  if (!currentQuery || currentQuery.refId !== baseline.refId) {
    return false;
  }

  if (isEqual(currentQuery, baseline)) {
    return true;
  }

  updateQuery(baseline, currentQuery.refId);
  return true;
}

export function useQueryProposalTransaction({
  query,
  queries,
  queryKey,
  adapter,
  updateQuery,
  runQueries,
  startQueryPreview,
}: QueryProposalTransactionOptions) {
  const queryRef = useRef(query);
  queryRef.current = query;
  const queriesRef = useRef(queries);
  queriesRef.current = queries;
  const transactionRef = useRef<QueryProposalTransactionState | undefined>(undefined);
  const proposalRef = useRef<DataQuery | undefined>(undefined);
  const previewRef = useRef<QueryPreview | undefined>(undefined);
  const runQueriesRef = useRef(runQueries);
  runQueriesRef.current = runQueries;
  const [proposal, setProposal] = useState<DataQuery | undefined>(undefined);
  const [previewPhase, setPreviewPhase] = useState<'idle' | 'pending' | 'running' | 'complete'>('idle');
  const [previewData, setPreviewData] = useState<PanelData>();

  const clear = useCallback((): QueryProposalTransactionState | undefined => {
    const transaction = transactionRef.current;
    previewRef.current?.dispose();
    previewRef.current = undefined;
    transactionRef.current = undefined;
    proposalRef.current = undefined;
    setProposal(undefined);
    setPreviewPhase('idle');
    setPreviewData(undefined);
    return transaction;
  }, []);

  useEffect(() => {
    return () => {
      const transaction = transactionRef.current;
      if (!transaction || transaction.queryKey !== queryKey) {
        return;
      }
      clear();
      runQueriesRef.current();
    };
  }, [clear, queryKey]);

  useEffect(() => {
    const transaction = transactionRef.current;
    if (!transaction || isEqual(queries, transaction.baselineQueries)) {
      return;
    }

    clear();
    adapter?.dismiss();
  }, [adapter, clear, queries]);

  const onChange = useCallback(
    (updatedQuery: DataQuery) => {
      const currentProposal = proposalRef.current;
      if (currentProposal?.refId === updatedQuery.refId) {
        if (isEqual(currentProposal, updatedQuery)) {
          return;
        }
        const originalRefId = clear()?.baseline.refId ?? updatedQuery.refId;
        adapter?.dismiss();
        updateQuery(updatedQuery, originalRefId);
        return;
      }
      updateQuery(updatedQuery, updatedQuery.refId);
    },
    [adapter, clear, updateQuery]
  );

  const preview = useCallback(
    (proposedQuery: DataQuery, options?: QueryPreviewSelection): boolean => {
      const currentQuery = queryRef.current;
      if (!currentQuery) {
        return false;
      }

      const transaction = transactionRef.current;
      if (transaction && transaction.queryKey !== queryKey) {
        return false;
      }

      const baseline = transaction?.baseline ?? currentQuery;
      transactionRef.current = transaction ?? {
        baseline,
        baselineQueries: queriesRef.current,
        queryKey,
      };
      proposalRef.current = proposedQuery;
      setProposal(proposedQuery);
      setPreviewPhase('pending');
      setPreviewData(undefined);
      const currentPreview = previewRef.current;
      if (currentPreview) {
        if (currentPreview.select(proposedQuery, options)) {
          return true;
        }
        clear();
        runQueriesRef.current();
        return false;
      }
      const queryPreview = startQueryPreview(baseline.refId, proposedQuery);
      if (!queryPreview) {
        clear();
        if (transaction) {
          runQueriesRef.current();
        }
        return false;
      }
      previewRef.current = queryPreview;
      queryPreview.subscribeToState((state) => {
        if (previewRef.current === queryPreview) {
          setPreviewPhase(state === LoadingState.Loading || state === LoadingState.Streaming ? 'running' : 'complete');
        }
      });
      queryPreview.subscribeToData((data) => {
        if (previewRef.current === queryPreview) {
          setPreviewData(data);
        }
      });
      return true;
    },
    [clear, queryKey, startQueryPreview]
  );

  const revert = useCallback(() => {
    if (clear()) {
      runQueries();
    }
  }, [clear, runQueries]);

  const run = useCallback(() => {
    if (clear()) {
      adapter?.dismiss();
    }
    runQueries();
  }, [adapter, clear, runQueries]);

  const accept = useCallback(
    (acceptedQuery: DataQuery): boolean => {
      const transaction = transactionRef.current;
      if (!transaction || transaction.queryKey !== queryKey) {
        return false;
      }

      clear();
      updateQuery(acceptedQuery, transaction.baseline.refId);
      runQueries();
      return true;
    },
    [clear, queryKey, runQueries, updateQuery]
  );

  const synchronizeBaseline = useCallback(
    (baseline: DataQuery): boolean => synchronizeCoauthoringBaselineQuery(queryRef.current, baseline, updateQuery),
    [updateQuery]
  );

  const readPreviewData = useCallback(() => previewRef.current?.data, []);

  return {
    accept,
    editorQueries: proposal
      ? queries.map((candidate) => (candidate.refId === proposal.refId ? proposal : candidate))
      : queries,
    editorQuery: proposal?.refId === query?.refId ? proposal : query,
    onChange,
    preview,
    previewData,
    readPreviewData,
    previewPhase,
    revert,
    run,
    synchronizeBaseline,
  };
}
