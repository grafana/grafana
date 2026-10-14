import { useState } from 'react';

import {
  type ResultItem as FolderResultItem,
  useListFolderSearchV1Beta1Mutation,
} from '@grafana/api-clients/rtkq/folder/v1beta1';
import { t } from '@grafana/i18n';
import { Button, LoadingPlaceholder, Stack } from '@grafana/ui';

import { FolderListRow } from '../folder-browsing/FolderListRow';
import { useFolderAlertRuleCount } from '../folder-browsing/folderLookups';
import { buildFolderListSearchQuery } from '../folder-browsing/folderSearchQuery';
import { useFolderPages } from '../folder-browsing/useFolderPages';
import { RuleRowList } from '../rule-row/RuleRowList';
import { createEmptyCriteria } from '../rule-search/criteria';
import { type ContinuationPage, useContinuationSearch } from '../shared/useContinuationSearch';

import { AlertRuleActions } from './AlertRuleActions';
import { AlertRuleRow } from './AlertRuleRow';
import { useAlertRuleSearch } from './alertRuleSearch';

interface FoldersViewProps {
  /** Folder UIDs from the active criterion - the only filter Folders mode supports. Scopes
   * the folder listing itself, not just what's shown once expanded. */
  folderUids: string[];
  /** Changes whenever a refresh/mutation should restart every open chain, including every
   * expanded folder's - folded into each chain's resetKey. */
  resetKey: unknown;
}

export function FoldersView({ folderUids, resetKey }: FoldersViewProps) {
  const [triggerFolderSearch] = useListFolderSearchV1Beta1Mutation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchPage = async (
    continueToken: string | undefined
  ): Promise<ContinuationPage<{ uid: string; title: string }>> => {
    const result = await triggerFolderSearch({
      searchQuery: buildFolderListSearchQuery(continueToken, folderUids),
    }).unwrap();
    return {
      items: result.items.map((item: FolderResultItem) => ({
        uid: item.resource.name,
        title: typeof item.fields?.title === 'string' ? item.fields.title : item.resource.name,
      })),
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
    return <LoadingPlaceholder text={t('alerting.gma-rule-list.alert-rules.loading-folders', 'Loading folders...')} />;
  }

  if (error) {
    return <div role="alert">{t('alerting.gma-rule-list.alert-rules.folders-error', 'Failed to load folders')}</div>;
  }

  if (items.length === 0) {
    return <div>{t('alerting.gma-rule-list.alert-rules.no-folders', 'No folders found')}</div>;
  }

  return (
    <Stack direction="column" gap={2}>
      <RuleRowList>
        {items.map((folder) => (
          <ExpandableFolderRow
            key={folder.uid}
            folderUid={folder.uid}
            title={folder.title}
            expanded={expanded.has(folder.uid)}
            onToggle={() => toggle(folder.uid)}
            resetKey={resetKey}
          />
        ))}
      </RuleRowList>
      <Stack direction="row" gap={1} justifyContent="flex-end">
        <Button variant="secondary" disabled={!hasPrevious} onClick={previous}>
          {t('alerting.gma-rule-list.alert-rules.previous', 'Previous')}
        </Button>
        <Button variant="secondary" disabled={!hasNext} onClick={next}>
          {t('alerting.gma-rule-list.alert-rules.next', 'Next')}
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
  resetKey: unknown;
}

function ExpandableFolderRow({ folderUid, title, expanded, onToggle, resetKey }: ExpandableFolderRowProps) {
  const count = useFolderAlertRuleCount(folderUid);

  return (
    <FolderListRow
      folderUid={folderUid}
      title={title}
      kind="alert"
      ruleCount={count}
      expanded={expanded}
      onToggle={onToggle}
    >
      {expanded && <ExpandedFolderRules folderUid={folderUid} resetKey={resetKey} />}
    </FolderListRow>
  );
}

function ExpandedFolderRules({ folderUid, resetKey }: { folderUid: string; resetKey: unknown }) {
  const searchRules = useAlertRuleSearch();

  const fetchPage = async (continueToken: string | undefined) => {
    const page = await searchRules({ ...createEmptyCriteria(), namespaces: [folderUid] }, { continueToken });
    return { items: page.hits, continueToken: page.continueToken };
  };

  const { rows, isLoading, error, loadMoreError, hasMore, loadMore, retry } = useContinuationSearch(
    fetchPage,
    `${folderUid}:${String(resetKey)}`
  );

  if (isLoading) {
    return (
      <li>
        <LoadingPlaceholder text={t('alerting.gma-rule-list.alert-rules.loading-rules', 'Loading rules...')} />
      </li>
    );
  }

  if (error) {
    return (
      <li>
        <div role="alert">{t('alerting.gma-rule-list.alert-rules.rules-error', 'Failed to load rules')}</div>
      </li>
    );
  }

  if (rows.length === 0) {
    return (
      <li>
        <div>{t('alerting.gma-rule-list.alert-rules.no-rules-in-folder', 'No Alert rules in this folder')}</div>
      </li>
    );
  }

  return (
    <>
      {rows.map((hit) => (
        <AlertRuleRow key={hit.uid} hit={hit} showFolderPath={false} actions={<AlertRuleActions ruleUid={hit.uid} />} />
      ))}
      {Boolean(loadMoreError) && (
        <li>
          <Stack direction="row" gap={1} alignItems="center">
            <div role="alert">
              {t('alerting.gma-rule-list.alert-rules.load-more-error', 'Failed to load more rules')}
            </div>
            <Button size="sm" variant="secondary" onClick={retry}>
              {t('alerting.gma-rule-list.alert-rules.retry', 'Retry')}
            </Button>
          </Stack>
        </li>
      )}
      {hasMore && !loadMoreError && (
        <li>
          <Button size="sm" variant="secondary" onClick={loadMore}>
            {t('alerting.gma-rule-list.alert-rules.load-more', 'Load more')}
          </Button>
        </li>
      )}
    </>
  );
}
