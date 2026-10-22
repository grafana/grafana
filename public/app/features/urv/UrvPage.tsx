import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  ControlledCollapse,
  Drawer,
  EmptyState,
  FilterInput,
  IconButton,
  LoadingPlaceholder,
  Spinner,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { useCreateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { extractErrorMessage } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';
import { useAppNotification } from 'app/core/copy/appNotification';
import { NewFolderForm } from 'app/features/browse-dashboards/components/NewFolderForm';

import { type ResultItem } from './api/globalSearchApi';
import { FilterBar } from './components/FilterBar';
import { FolderSidebar } from './components/FolderSidebar';
import { NewResourceButton } from './components/NewResourceButton';
import { FlatResults, ResourceGroup } from './components/ResourceGroup';
import { type RowHandlers, itemKey } from './components/ResourceTable';
import { SelectionBar } from './components/SelectionBar';
import { TypeTabs } from './components/TypeTabs';
import { useFolderSidebar } from './hooks/useFolderSidebar';
import { useGlobalSearch } from './hooks/useGlobalSearch';
import { useOwnerNames } from './hooks/useOwnerNames';
import { usePlaceScope, useStarredKeys } from './hooks/usePlaceScope';
import { NO_FOLDER, useUrvState } from './hooks/useUrvState';

// The index catches up a moment after a write, so wait before searching again.
const REFRESH_AFTER_WRITE_MS = 1000;

export default function UrvPage() {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();
  const { state, update } = useUrvState();
  const scope = usePlaceScope(state.place);
  const search = useGlobalSearch(state, scope);
  const owners = useOwnerNames();
  const starredKeys = useStarredKeys();
  const [folderFilter, setFolderFilter] = useState('');
  const sidebar = useFolderSidebar(folderFilter);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [createFolder] = useCreateFolder();
  const [selected, setSelected] = useState<Map<string, ResultItem>>(new Map());

  const realFolder = state.folder && state.folder !== NO_FOLDER ? state.folder : undefined;

  const afterWrite = () => {
    search.refresh(REFRESH_AFTER_WRITE_MS);
    setTimeout(sidebar.reload, REFRESH_AFTER_WRITE_MS);
  };

  const removeItems = (items: ResultItem[]) => {
    items.forEach((item) => search.removeItem(item.resource));
    setSelected((prev) => {
      const next = new Map(prev);
      items.forEach((item) => next.delete(itemKey(item)));
      return next;
    });
    afterWrite();
  };

  const setItemsSelected = (items: ResultItem[], on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      items.forEach((item) => (on ? next.set(itemKey(item), item) : next.delete(itemKey(item))));
      return next;
    });

  const onCreateFolder = async (title: string) => {
    const result = await createFolder({ title, parentUid: realFolder });
    setShowNewFolder(false);
    if (result.error) {
      notifyApp.error(t('urv.new.folder-failed', 'Failed to create folder'), extractErrorMessage(result.error));
      return;
    }
    notifyApp.success(t('urv.new.folder-created', 'Folder created'));
    afterWrite();
  };

  const handlers: RowHandlers = {
    folderTitles: search.folderTitles,
    ownerName: owners.resolve,
    starredKeys,
    isSelected: (item) => selected.has(itemKey(item)),
    onToggleSelected: (item) => setItemsSelected([item], !selected.has(itemKey(item))),
    onOpenFolder: (folder) => update({ folder }),
    onChanged: afterWrite,
    onDeleted: (item) => removeItems([item]),
  };

  const heading =
    state.folder === NO_FOLDER
      ? t('urv.heading.no-folder', 'No folder')
      : realFolder
        ? (search.folderTitles[realFolder] ?? realFolder)
        : t('urv.heading.all', 'All resources');
  const shownTotal = state.type ? (search.groups[0]?.total ?? 0) : search.counts.total;
  const hasResults = search.groups.some((group) => group.items.length > 0);
  const grouped = !state.type && state.group === 'type';

  const pageNav: NavModelItem = { text: t('urv.page.title', 'Resources'), icon: 'layer-group' };

  return (
    <Page
      navModel={{ node: pageNav, main: pageNav }}
      actions={<NewResourceButton folderUID={realFolder} onNewFolder={() => setShowNewFolder(true)} />}
    >
      <Page.Contents>
        <Stack direction="column" gap={2}>
          <TypeTabs
            types={search.counts.types}
            total={search.counts.total}
            selected={state.type}
            onSelect={(type) => update({ type })}
          />
          <FilterInput
            value={state.query}
            onChange={(query) => update({ query })}
            escapeRegex={false}
            placeholder={t('urv.search.placeholder', 'Search all resources')}
          />
          <FilterBar
            state={state}
            update={update}
            types={search.counts.types}
            tags={search.counts.tags}
            owners={owners.options}
            ownerName={owners.resolve}
          />

          <div className={styles.body}>
            {sidebarOpen && (
              <div className={styles.sidebar}>
                <FolderSidebar
                  sidebar={sidebar}
                  filter={folderFilter}
                  onFilterChange={setFolderFilter}
                  selected={state.folder}
                  onSelect={(folder) => update({ folder })}
                  onNewFolder={() => setShowNewFolder(true)}
                  onCollapse={() => setSidebarOpen(false)}
                />
              </div>
            )}

            <div className={styles.main}>
              <Stack alignItems="center" gap={1}>
                {!sidebarOpen && (
                  <IconButton
                    name="angle-double-right"
                    tooltip={t('urv.sidebar.show', 'Show folders')}
                    onClick={() => setSidebarOpen(true)}
                  />
                )}
                <Text element="h2" variant="h4">
                  {heading}
                </Text>
                <Text color="secondary">
                  {t('urv.heading.count', '', {
                    count: shownTotal,
                    total: shownTotal.toLocaleString(),
                    defaultValue_one: '{{total}} resource',
                    defaultValue_other: '{{total}} resources',
                  })}
                </Text>
                {search.isLoading && hasResults && <Spinner size="sm" />}
              </Stack>

              {selected.size > 0 && (
                <SelectionBar
                  items={[...selected.values()]}
                  onClear={() => setSelected(new Map())}
                  onMoved={() => {
                    setSelected(new Map());
                    afterWrite();
                  }}
                  onDeleted={removeItems}
                />
              )}

              {search.counts.skippedTypes.length > 0 && (
                <Alert severity="warning" title={t('urv.alerts.skipped', 'Some types were left out of the search')}>
                  {search.counts.skippedTypes.join(', ')}
                </Alert>
              )}
              {search.error !== undefined && (
                <Alert severity="error" title={t('urv.alerts.error', 'Search failed')}>
                  {extractErrorMessage(search.error)}
                </Alert>
              )}

              {!hasResults && search.isLoading && <LoadingPlaceholder text={t('urv.loading', 'Loading...')} />}
              {!hasResults && !search.isLoading && search.error === undefined && (
                <EmptyState variant="not-found" message={t('urv.empty', 'No resources match these filters')} />
              )}

              {hasResults &&
                (grouped ? (
                  search.groups
                    .filter((group) => group.items.length > 0)
                    .map((group) => (
                      <ResourceGroup
                        key={group.type}
                        group={group}
                        sort={state.sort}
                        onSort={(sort) => update({ sort })}
                        onLoadMore={() => search.loadMore(group.type)}
                        onViewAll={() => update({ type: group.type })}
                        onSelectAll={(on) => setItemsSelected(group.items, on)}
                        {...handlers}
                      />
                    ))
                ) : (
                  <FlatResults
                    group={search.groups[0]}
                    sort={state.sort}
                    onSort={(sort) => update({ sort })}
                    onLoadMore={() => search.loadMore(search.groups[0].type)}
                    onSelectAll={(on) => setItemsSelected(search.groups[0].items, on)}
                    {...handlers}
                  />
                ))}

              <ControlledCollapse label={t('urv.debug.title', 'Debug')} isOpen={false}>
                <pre className={styles.debug}>{JSON.stringify(search.debug, null, 2)}</pre>
              </ControlledCollapse>
            </div>
          </div>
        </Stack>

        {showNewFolder && (
          <Drawer title={t('urv.new.folder-title', 'New folder')} onClose={() => setShowNewFolder(false)} size="sm">
            <NewFolderForm onConfirm={onCreateFolder} onCancel={() => setShowNewFolder(false)} />
          </Drawer>
        )}
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  body: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(3),
  }),
  sidebar: css({
    width: 260,
    flexShrink: 0,
    position: 'sticky',
    top: theme.spacing(2),
  }),
  main: css({
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  debug: css({
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  }),
});
