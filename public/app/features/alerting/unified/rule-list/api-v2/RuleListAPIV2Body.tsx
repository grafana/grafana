import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Stack, useStyles2 } from '@grafana/ui';

import { useRulesFilter } from '../../hooks/useFilteredRules';

import { ExternalSourceFetcher } from './components/ExternalSourceFetcher';
import { FilterPanel } from './components/FilterPanel';
import { FolderDetail } from './components/FolderDetail';
import { FolderRail } from './components/FolderRail';
import { PageHeader } from './components/PageHeader';
import { RecentlyDeletedView } from './components/RecentlyDeletedView';
import { SearchRow } from './components/SearchRow';
import { useRuleTree } from './hooks/useRuleTree';
import { useSelectedFolder } from './hooks/useSelectedFolder';
import { useStateChipFilter } from './hooks/useStateChipFilter';
import { findDataSource, findFolder } from './lib/treeModel';

export function RuleListAPIV2Body() {
  const styles = useStyles2(getStyles);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const { filteredTree, preStateTree, externalDataSources, publishExternalResult } = useRuleTree();
  const chip = useStateChipFilter(preStateTree);
  const displayedTree = chip.applyToTree(filteredTree);

  const { view, selectFolder, selectDeleted } = useSelectedFolder();
  const { activeFilters } = useRulesFilter();
  const filterCount = activeFilters.length + (chip.hasActiveChips ? 1 : 0);

  const defaultFolder = useMemo(() => {
    const firstDs = displayedTree.dataSources.find((d) => d.folders.length > 0);
    if (!firstDs) {
      return undefined;
    }
    return { dataSourceUid: firstDs.uid, folderKey: firstDs.folders[0].key };
  }, [displayedTree]);

  const effectiveView =
    view.kind === 'empty' && defaultFolder ? ({ kind: 'folder', folder: defaultFolder } as const) : view;

  return (
    <div className={styles.wrapper}>
      {externalDataSources.map((ds) => (
        <ExternalSourceFetcher key={ds.uid} uid={ds.uid} name={ds.name} onResult={publishExternalResult} />
      ))}

      <PageHeader />

      <div className={styles.filterRegion}>
        <SearchRow
          filterCount={filterCount}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((prev) => !prev)}
        />
        {filtersOpen && (
          <div id="rule-list-v2-filter-panel">
            <FilterPanel
              counts={chip.counts}
              activeChips={chip.active}
              onToggleChip={chip.toggle}
              hasAnyActive={chip.hasActiveChips}
              onClearAll={chip.clear}
            />
          </div>
        )}
      </div>

      <div className={styles.splitWrapper}>
        <Stack direction="row" gap={0} alignItems="stretch">
          <FolderRail
            tree={displayedTree}
            view={effectiveView}
            onSelectFolder={selectFolder}
            onSelectDeleted={selectDeleted}
          />
          <main className={styles.main}>{renderMain(effectiveView, displayedTree, styles.empty)}</main>
        </Stack>
      </div>
    </div>
  );
}

function renderMain(
  view: ReturnType<typeof useSelectedFolder>['view'],
  tree: ReturnType<typeof useRuleTree>['filteredTree'],
  emptyClass: string
) {
  if (view.kind === 'deleted') {
    return <RecentlyDeletedView />;
  }
  if (view.kind === 'folder') {
    return renderFolderDetail(tree, view.folder);
  }
  return (
    <div className={emptyClass}>
      <Trans i18nKey="alerting.rule-list-v2.select-folder">Select a folder from the left to see its rules.</Trans>
    </div>
  );
}

function renderFolderDetail(
  tree: ReturnType<typeof useRuleTree>['filteredTree'],
  folder: { dataSourceUid: string; folderKey: string }
) {
  const ds = findDataSource(tree, folder.dataSourceUid);
  const fld = findFolder(tree, folder.dataSourceUid, folder.folderKey);
  if (!ds || !fld) {
    return (
      <div>
        <Trans i18nKey="alerting.rule-list-v2.no-matching-folder">No matching folder.</Trans>
      </div>
    );
  }
  return <FolderDetail dataSource={ds} folder={fld} />;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    filterRegion: css({
      padding: theme.spacing(0, 2),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    splitWrapper: css({
      padding: theme.spacing(0, 2),
    }),
    main: css({
      flex: 1,
      minWidth: 0,
    }),
    empty: css({
      padding: theme.spacing(4),
      color: theme.colors.text.secondary,
    }),
  };
}
