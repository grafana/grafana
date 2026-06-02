import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type AlertRule,
  type RecordingRule,
  useLazyListAlertRuleQuery,
  useLazyListRecordingRuleQuery,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

const RULE_PAGE_SIZE = 24;
const GROUP_LABEL = 'grafana.com/group';
const GROUP_INDEX_LABEL = 'grafana.com/group-index';

export type RecordingSplitMode =
  | 'header-tabs'
  | 'nested-tabs'
  | 'inline-divider'
  | 'mixed-badged'
  | 'folder-chip'
  | 'tabbed';

export const RECORDING_SPLIT_MODES: RecordingSplitMode[] = [
  'header-tabs',
  'nested-tabs',
  'inline-divider',
  'mixed-badged',
  'folder-chip',
  'tabbed',
];

export const DEFAULT_RECORDING_SPLIT_MODE: RecordingSplitMode = 'header-tabs';

export function parseRecordingSplitMode(mode: string | null): RecordingSplitMode {
  const match = RECORDING_SPLIT_MODES.find((value) => value === mode);
  return match ?? DEFAULT_RECORDING_SPLIT_MODE;
}

// Cursor-based pagination state for a single rule kind. We never know the total
// upfront, so `hasMore` is driven purely by the presence of a continue token.
export interface PaginatedKind<T> {
  items: T[];
  loadedCount: number;
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
  /** "24+" while a continue token exists, the exact count once exhausted. */
  countLabel: string;
}

export interface UseK8sFolderRulesResult {
  alerting: PaginatedKind<AlertRule>;
  recording: PaginatedKind<RecordingRule>;
  hasRecording: boolean;
  isInitialLoading: boolean;
  error: unknown;
}

type RuleWithMeta = Pick<AlertRule, 'metadata'> | Pick<RecordingRule, 'metadata'>;

function paginatedCount(loaded: number, hasMore: boolean): string {
  return hasMore ? `${loaded}+` : `${loaded}`;
}

/**
 * Loads a single rule kind for a folder with cursor pagination. The first page is
 * fetched eagerly on mount (so folder headers can show counts / tab strips before
 * the folder is expanded). `loadMore` appends the next page.
 */
function usePaginatedRuleKind<T extends RuleWithMeta>(
  trigger: (args: { labelSelector: string; limit: number; continue?: string }) => {
    unwrap: () => Promise<{ items?: T[]; metadata?: { continue?: string } }>;
  },
  labelSelector: string,
  enabled: boolean,
  onError: (err: unknown) => void
): PaginatedKind<T> {
  const [items, setItems] = useState<T[]>([]);
  const [continueToken, setContinueToken] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(enabled);
  const didInit = useRef(false);

  const fetchPage = useCallback(
    async (token: string | undefined) => {
      setIsLoading(true);
      try {
        const response = await trigger({ labelSelector, limit: RULE_PAGE_SIZE, continue: token }).unwrap();
        const next = response.metadata?.continue;
        setItems((current) => sortRules([...current, ...(response.items ?? [])]));
        setContinueToken(next);
        setHasMore(Boolean(next));
      } catch (err) {
        onError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [trigger, labelSelector, onError]
  );

  // Reset + eager first page whenever the selector changes.
  useEffect(() => {
    didInit.current = false;
    setItems([]);
    setContinueToken(undefined);
    setHasMore(false);

    if (!enabled) {
      setIsLoading(false);
      return;
    }
    if (didInit.current) {
      return;
    }
    didInit.current = true;
    fetchPage(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelSelector, enabled]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) {
      return;
    }
    fetchPage(continueToken);
  }, [hasMore, isLoading, continueToken, fetchPage]);

  return {
    items,
    loadedCount: items.length,
    hasMore,
    isLoading,
    loadMore,
    countLabel: paginatedCount(items.length, hasMore),
  };
}

export function useK8sFolderRules(folderUid: string, groupFilter?: string): UseK8sFolderRulesResult {
  const [error, setError] = useState<unknown>(undefined);
  const onError = useCallback((err: unknown) => setError(err), []);

  const labelSelector = buildLabelSelector(folderUid, groupFilter);

  const [triggerAlerting] = useLazyListAlertRuleQuery();
  const [triggerRecording] = useLazyListRecordingRuleQuery();

  const alerting = usePaginatedRuleKind<AlertRule>(
    (args) => triggerAlerting(args),
    labelSelector,
    true,
    onError
  );
  const recording = usePaginatedRuleKind<RecordingRule>(
    (args) => triggerRecording(args),
    labelSelector,
    true,
    onError
  );

  const isInitialLoading =
    (alerting.isLoading && alerting.loadedCount === 0) ||
    (recording.isLoading && recording.loadedCount === 0);

  return {
    alerting,
    recording,
    hasRecording: recording.loadedCount > 0,
    isInitialLoading,
    error,
  };
}

function buildLabelSelector(folderUid: string, groupFilter?: string): string {
  const selectors = [`grafana.app/folder=${folderUid}`];
  if (groupFilter?.trim()) {
    selectors.push(`${GROUP_LABEL}=${groupFilter.trim()}`);
  }
  return selectors.join(',');
}

function sortRules<T extends RuleWithMeta>(rules: T[]): T[] {
  return [...rules].sort(sortByGroupThenIndexThenName);
}

function sortByGroupThenIndexThenName(a: RuleWithMeta, b: RuleWithMeta) {
  const aLabels = a.metadata.labels ?? {};
  const bLabels = b.metadata.labels ?? {};

  const aGroup = aLabels[GROUP_LABEL] ?? '';
  const bGroup = bLabels[GROUP_LABEL] ?? '';
  if (aGroup !== bGroup) {
    return aGroup < bGroup ? -1 : 1;
  }

  const aIndex = Number(aLabels[GROUP_INDEX_LABEL] ?? 0);
  const bIndex = Number(bLabels[GROUP_INDEX_LABEL] ?? 0);
  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }

  const aName = a.metadata.name ?? '';
  const bName = b.metadata.name ?? '';
  if (aName === bName) {
    return 0;
  }
  return aName < bName ? -1 : 1;
}
