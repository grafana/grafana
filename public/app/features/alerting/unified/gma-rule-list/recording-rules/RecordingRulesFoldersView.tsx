import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Box, EmptyState, LoadingPlaceholder, Stack, Text } from '@grafana/ui';

import LoadMoreHelper from '../../rule-list/LoadMoreHelper';
import { FolderListRow } from '../folder-browsing/FolderListRow';
import { FolderRuleCount } from '../folder-browsing/FolderRuleCount';
import { useFolderPath } from '../folder-browsing/folderLookups';
import { useSearchRuleFoldersInfiniteQuery } from '../folder-browsing/folderSearch';
import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';
import { RuleRowList } from '../rule-row/RuleRowList';
import { createRulesApiFilter } from '../rule-search/sharedRuleFilter';
import { InlineRequestError } from '../shared/InlineRequestError';
import { LoadMoreFooter } from '../shared/LoadMoreFooter';
import { PagedFailureAlert } from '../shared/PagedFailureAlert';

import { RecordingRuleListEntry } from './RecordingRuleListEntry';
import { useRecordingRuleSearch } from './recordingRuleSearch';

interface FoldersViewProps {
  /** The only filter Folders mode supports; scopes the folder listing itself. */
  folderNames: string[];
}

export function RecordingRulesFoldersView({ folderNames }: FoldersViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    useSearchRuleFoldersInfiniteQuery({ kind: 'recording', folderNames });
  const folders = data?.pages.flatMap((page) => page.folders);

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

  if (!folders) {
    return isError ? (
      <InlineRequestError
        title={t('alerting.gma-rule-list.recording-rules.folders-error', 'Failed to load folders')}
        error={error}
        onRetry={() => void refetch()}
      />
    ) : (
      <LoadingPlaceholder text={t('alerting.gma-rule-list.recording-rules.loading-folders', 'Loading folders...')} />
    );
  }

  if (folders.length === 0) {
    return (
      <EmptyState
        variant="not-found"
        message={
          folderNames.length > 0
            ? t('alerting.gma-rule-list.recording-rules.no-rules-match-folder', 'No recording rules match this folder')
            : t('alerting.gma-rule-list.recording-rules.no-rules', 'No recording rules found')
        }
      />
    );
  }

  return (
    <Stack direction="column" gap={2}>
      <RuleRowList>
        {folders.map((folder) => (
          <RecordingFolderListEntry
            key={folder.uid}
            folderUid={folder.uid}
            title={folder.title}
            expanded={expanded.has(folder.uid)}
            onToggle={() => toggle(folder.uid)}
          />
        ))}
      </RuleRowList>
      {isError && <PagedFailureAlert failure={{ kind: 'load-more', error }} onRetry={() => void refetch()} />}
      {isFetchingNextPage && <RuleListSkeleton />}
      {/* Remounted after each batch: an observer only reports changes, so this re-checks whether the end is in view. */}
      {hasNextPage && !isFetchingNextPage && !isError && <LoadMoreHelper handleLoad={fetchNextPage} />}
    </Stack>
  );
}

interface RecordingFolderListEntryProps {
  folderUid: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}

function RecordingFolderListEntry({ folderUid, title, expanded, onToggle }: RecordingFolderListEntryProps) {
  const path = useFolderPath(folderUid);
  // The last segment is the folder itself, already shown as the title.
  const parents = path ? path.slice(0, -1) : [];

  return (
    <FolderListRow
      folderUid={folderUid}
      title={title}
      parents={parents}
      count={<FolderRuleCount folderUid={folderUid} kind="recording" />}
      expanded={expanded}
      onToggle={onToggle}
    >
      <ExpandedFolderRules folderUid={folderUid} title={title} />
    </FolderListRow>
  );
}

function ExpandedFolderRules({ folderUid, title }: { folderUid: string; title: string }) {
  const { items, isLoading, error, failure, hasMore, isLoadingMore, loadMore, retry } = useRecordingRuleSearch(
    createRulesApiFilter(),
    { inFolderUid: folderUid }
  );

  const retryLabel = t(
    'alerting.gma-rule-list.recording-rules.retry-rules-in-folder',
    'Retry loading rules in {{title}}',
    {
      interpolation: { escapeValue: false },
      title,
    }
  );

  if (isLoading) {
    return (
      <li>
        <RuleListSkeleton />
      </li>
    );
  }

  if (error !== undefined) {
    return (
      <li>
        <InlineRequestError
          title={t('alerting.gma-rule-list.recording-rules.folder-rules-error', 'Failed to load rules')}
          error={error}
          onRetry={retry}
          retryLabel={retryLabel}
        />
      </li>
    );
  }

  if (items.length === 0 && !failure) {
    return (
      <li>
        <Box padding={1}>
          <Text color="secondary">
            {t('alerting.gma-rule-list.recording-rules.no-rules-in-folder', 'No recording rules in this folder')}
          </Text>
        </Box>
      </li>
    );
  }

  return (
    <>
      {items.map((searchHit) => (
        <RecordingRuleListEntry key={searchHit.uid} searchHit={searchHit} showFolderPath={false} />
      ))}
      {(hasMore || failure) && (
        <li>
          <LoadMoreFooter
            label={t(
              'alerting.gma-rule-list.recording-rules.load-more-rules-in-folder',
              'Load more rules in {{title}}',
              {
                interpolation: { escapeValue: false },
                title,
              }
            )}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            failure={failure}
            onLoadMore={loadMore}
            onRetry={retry}
            retryLabel={retryLabel}
          />
        </li>
      )}
    </>
  );
}
