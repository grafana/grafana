import { useState } from 'react';

import { type ResultItem as FolderResultItem, useListFolderSearchV1Beta1Mutation } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { useListRecordingRuleSearchV0Alpha1Mutation } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Button, LoadingPlaceholder, Stack } from '@grafana/ui';

import { buildRecordingRuleSearchQuery } from '../search/searchQuery';
import { createEmptyCriteria } from '../search/types';
import { FolderListRow } from '../shared/FolderListRow';
import { useFolderRecordingRuleCount } from '../shared/caches';
import { buildFolderListSearchQuery } from '../shared/folderSearchQuery';
import { type ContinuationPage, useContinuationSearch } from '../shared/useContinuationSearch';
import { useFolderPages } from '../shared/useFolderPages';

import { RecordingRuleActions } from './RecordingRuleActions';
import { RecordingRuleRow } from './RecordingRuleRow';
import { toRecordingRuleSearchHit } from './searchHit';

interface FoldersViewProps {
  folderUids: string[];
  resetKey: unknown;
}

export function FoldersView({ folderUids, resetKey }: FoldersViewProps) {
  const [triggerFolderSearch] = useListFolderSearchV1Beta1Mutation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchPage = async (continueToken: string | undefined): Promise<ContinuationPage<{ uid: string }>> => {
    const result = await triggerFolderSearch({
      searchQuery: buildFolderListSearchQuery(continueToken, folderUids),
    }).unwrap();
    return {
      items: result.items.map((item: FolderResultItem) => ({ uid: item.resource.name })),
      continueToken: result.metadata.continue,
    };
  };

  const { items, isLoading, error, hasNext, hasPrevious, next, previous } = useFolderPages(fetchPage, resetKey);

  const toggle = (uid: string) => {
    setExpanded((prev) => {
      const updated = new Set(prev);
      if (updated.has(uid)) {
        updated.delete(uid);
      } else {
        updated.add(uid);
      }
      return updated;
    });
  };

  if (isLoading) {
    return (
      <LoadingPlaceholder text={t('alerting.gma-rule-list.recording-rules.loading-folders', 'Loading folders...')} />
    );
  }

  if (error) {
    return (
      <div role="alert">{t('alerting.gma-rule-list.recording-rules.folders-error', 'Failed to load folders')}</div>
    );
  }

  if (items.length === 0) {
    return <div>{t('alerting.gma-rule-list.recording-rules.no-folders', 'No folders found')}</div>;
  }

  return (
    <Stack direction="column" gap={1}>
      {items.map((folder) => (
        <ExpandableFolderRow
          key={folder.uid}
          folderUid={folder.uid}
          expanded={expanded.has(folder.uid)}
          onToggle={() => toggle(folder.uid)}
          resetKey={resetKey}
        />
      ))}
      <Stack direction="row" gap={1}>
        <Button variant="secondary" disabled={!hasPrevious} onClick={previous}>
          {t('alerting.gma-rule-list.recording-rules.previous', 'Previous')}
        </Button>
        <Button variant="secondary" disabled={!hasNext} onClick={next}>
          {t('alerting.gma-rule-list.recording-rules.next', 'Next')}
        </Button>
      </Stack>
    </Stack>
  );
}

interface ExpandableFolderRowProps {
  folderUid: string;
  expanded: boolean;
  onToggle: () => void;
  resetKey: unknown;
}

function ExpandableFolderRow({ folderUid, expanded, onToggle, resetKey }: ExpandableFolderRowProps) {
  const count = useFolderRecordingRuleCount(folderUid);

  return (
    <FolderListRow folderUid={folderUid} ruleCount={count} expanded={expanded} onToggle={onToggle}>
      {expanded && <ExpandedFolderRules folderUid={folderUid} resetKey={resetKey} />}
    </FolderListRow>
  );
}

function ExpandedFolderRules({ folderUid, resetKey }: { folderUid: string; resetKey: unknown }) {
  const [triggerRuleSearch] = useListRecordingRuleSearchV0Alpha1Mutation();

  const fetchPage = async (continueToken: string | undefined) => {
    const query = buildRecordingRuleSearchQuery(
      { ...createEmptyCriteria(), namespaces: [folderUid] },
      { continue: continueToken }
    );
    const result = await triggerRuleSearch({ searchQuery: query }).unwrap();
    return {
      items: result.items.map(toRecordingRuleSearchHit),
      continueToken: result.metadata.continue,
    };
  };

  const { rows, isLoading, error, loadMoreError, hasMore, loadMore, retry } = useContinuationSearch(
    fetchPage,
    `${folderUid}:${String(resetKey)}`
  );

  if (isLoading) {
    return (
      <LoadingPlaceholder text={t('alerting.gma-rule-list.recording-rules.loading-rules', 'Loading rules...')} />
    );
  }

  if (error) {
    return (
      <div role="alert">{t('alerting.gma-rule-list.recording-rules.rules-error', 'Failed to load rules')}</div>
    );
  }

  if (rows.length === 0) {
    return (
      <div>
        {t('alerting.gma-rule-list.recording-rules.no-rules-in-folder', 'No Recording rules in this folder')}
      </div>
    );
  }

  return (
    <Stack direction="column" gap={0.5}>
      {rows.map((hit) => (
        <RecordingRuleRow
          key={hit.uid}
          hit={hit}
          showFolderPath={false}
          actions={<RecordingRuleActions ruleUid={hit.uid} />}
        />
      ))}
      {Boolean(loadMoreError) && (
        <Stack direction="row" gap={1} alignItems="center">
          <div role="alert">
            {t('alerting.gma-rule-list.recording-rules.load-more-error', 'Failed to load more rules')}
          </div>
          <Button size="sm" variant="secondary" onClick={retry}>
            {t('alerting.gma-rule-list.recording-rules.retry', 'Retry')}
          </Button>
        </Stack>
      )}
      {hasMore && !loadMoreError && (
        <Button size="sm" variant="secondary" onClick={loadMore}>
          {t('alerting.gma-rule-list.recording-rules.load-more', 'Load more')}
        </Button>
      )}
    </Stack>
  );
}
