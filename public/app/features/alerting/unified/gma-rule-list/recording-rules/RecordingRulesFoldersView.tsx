import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Button, EmptyState, LoadingPlaceholder, Stack } from '@grafana/ui';

import { FolderListRow } from '../folder-browsing/FolderListRow';
import { useFolderRecordingRuleCount } from '../folder-browsing/folderLookups';
import { useFolderPages } from '../folder-browsing/useFolderPages';
import { RuleListItemSkeletons } from '../rule-row/RuleListSkeleton';
import { RuleRowList } from '../rule-row/RuleRowList';
import { createEmptyFilter } from '../rule-search/ruleSearchFilter';
import { InlineRequestError } from '../shared/InlineRequestError';
import { LoadMoreFooter } from '../shared/LoadMoreFooter';
import { PagedFailureAlert } from '../shared/PagedFailureAlert';

import { RecordingRuleListEntry } from './RecordingRuleListEntry';
import { useRecordingRuleSearch } from './recordingRuleSearch';

interface FoldersViewProps {
  /** The only filter Folders mode supports; scopes the folder listing itself. */
  folderUids: string[];
}

export function RecordingRulesFoldersView({ folderUids }: FoldersViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { folders, isLoading, error, failure, isLoadingPage, hasNext, hasPrevious, next, previous, retry } =
    useFolderPages(folderUids);

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

  if (error !== undefined) {
    return (
      <InlineRequestError
        title={t('alerting.gma-rule-list.recording-rules.folders-error', 'Failed to load folders')}
        error={error}
        onRetry={retry}
      />
    );
  }

  if (folders.length === 0 && !failure) {
    // A folder filter that matches no labelled folder means the folder has no rules of this kind.
    return folderUids.length > 0 ? (
      <EmptyState
        variant="not-found"
        message={t(
          'alerting.gma-rule-list.recording-rules.no-rules-match-folder',
          'No recording rules match this folder'
        )}
      />
    ) : (
      <EmptyState
        variant="not-found"
        message={t('alerting.gma-rule-list.recording-rules.no-folders', 'No folders found')}
      />
    );
  }

  return (
    <Stack direction="column" gap={2}>
      <RuleRowList>
        {folders.map((folder) => (
          <ExpandableFolderRow
            key={folder.uid}
            folderUid={folder.uid}
            title={folder.title}
            expanded={expanded.has(folder.uid)}
            onToggle={() => toggle(folder.uid)}
          />
        ))}
      </RuleRowList>
      {failure && <PagedFailureAlert failure={failure} onRetry={retry} />}
      <Stack direction="row" gap={1} justifyContent="flex-end">
        <Button variant="secondary" disabled={!hasPrevious} onClick={previous}>
          {t('alerting.gma-rule-list.recording-rules.previous', 'Previous')}
        </Button>
        <Button variant="secondary" disabled={!hasNext || isLoadingPage} onClick={next}>
          {t('alerting.gma-rule-list.recording-rules.next', 'Next')}
        </Button>
      </Stack>
    </Stack>
  );
}

interface ExpandableFolderRowProps {
  folderUid: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}

function ExpandableFolderRow({ folderUid, title, expanded, onToggle }: ExpandableFolderRowProps) {
  const count = useFolderRecordingRuleCount(folderUid);

  return (
    <FolderListRow
      folderUid={folderUid}
      title={title}
      kind="recording"
      count={count}
      expanded={expanded}
      onToggle={onToggle}
    >
      {expanded && <ExpandedFolderRules folderUid={folderUid} />}
    </FolderListRow>
  );
}

function ExpandedFolderRules({ folderUid }: { folderUid: string }) {
  const { items, isLoading, error, failure, hasMore, isLoadingMore, loadMore, retry } = useRecordingRuleSearch({
    ...createEmptyFilter(),
    folders: [folderUid],
  });

  if (isLoading) {
    return <RuleListItemSkeletons />;
  }

  if (error !== undefined) {
    return (
      <li>
        <InlineRequestError
          title={t('alerting.gma-rule-list.recording-rules.rules-error', 'Failed to load recording rules')}
          error={error}
          onRetry={retry}
        />
      </li>
    );
  }

  if (items.length === 0 && !failure) {
    return (
      <li>
        <div>{t('alerting.gma-rule-list.recording-rules.no-rules-in-folder', 'No recording rules in this folder')}</div>
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
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            failure={failure}
            onLoadMore={loadMore}
            onRetry={retry}
          />
        </li>
      )}
    </>
  );
}
