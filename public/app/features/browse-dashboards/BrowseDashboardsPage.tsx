import { css } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';
import AutoSizer, { type Size } from 'react-virtualized-auto-sizer';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Drawer, FilterInput, IconButton, useStyles2, Text, Stack } from '@grafana/ui';
import { useGetFolderQueryFacade, useUpdateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { Page } from 'app/core/components/Page/Page';
import { useDispatch } from 'app/types/store';

import { FolderRepo } from '../../core/components/NestedFolderPicker/FolderRepo';
import { ManagerKind } from '../apiserver/types';
import { TemplateDashboardModal } from '../dashboard/dashgrid/DashboardLibrary/TemplateDashboardModal';
import { buildNavModel, getDashboardsTabID } from '../folders/state/navModel';
import { FolderReadmeHint } from '../provisioning/components/Folders/FolderReadmeHint';
import { ProvisionedFolderPreviewBanner } from '../provisioning/components/Folders/ProvisionedFolderPreviewBanner';
import { RenameProvisionedFolderForm } from '../provisioning/components/Folders/RenameProvisionedFolderForm';
import { OrphanedResourceBanner } from '../provisioning/components/Shared/OrphanedResourceBanner';
import { RepoViewStatus, useGetResourceRepositoryView } from '../provisioning/hooks/useGetResourceRepositoryView';
import { useSearchStateManager } from '../search/state/SearchStateManager';
import { getSearchPlaceholder } from '../search/tempI18nPhrases';

import { BrowseActions } from './components/BrowseActions/BrowseActions';
import { BrowseFilters } from './components/BrowseFilters';
import { BrowseView } from './components/BrowseView';
import { FolderDetailsActions } from './components/FolderDetailsActions/FolderDetailsActions';
import { QuotaLimitBanner } from './components/QuotaLimitBanner';
import { RecentlyViewedDashboards } from './components/RecentlyViewedDashboards';
import { SearchView } from './components/SearchView';
import { getFolderPermissions } from './permissions';
import { useHasSelection } from './state/hooks';
import { setAllSelection } from './state/slice';

// New Browse/Manage/Search Dashboards views for nested folders
const BrowseDashboardsPage = memo(({ queryParams }: { queryParams: Record<string, string> }) => {
  const { uid: folderUID } = useParams();
  const dispatch = useDispatch();

  const styles = useStyles2(getStyles);
  const [searchState, stateManager] = useSearchStateManager();
  const isSearching = stateManager.hasSearchFilters();
  const location = useLocation();
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const {
    isReadOnlyRepo,
    status: repoViewStatus,
    orphanedRepoName,
    repository,
  } = useGetResourceRepositoryView({ folderName: folderUID });
  const isRecentlyViewedEnabledValue = useBooleanFlagValue('recentlyViewedDashboards', false);
  const isExperimentRecentlyViewedDashboards = useBooleanFlagValue('experimentRecentlyViewedDashboards', false);
  const isRecentlyViewedEnabled = !folderUID && isRecentlyViewedEnabledValue;

  useEffect(() => {
    stateManager.initStateFromUrl(folderUID);

    // Clear selected state when folderUID changes
    dispatch(
      setAllSelection({
        isSelected: false,
        folderUID: undefined,
      })
    );
  }, [dispatch, folderUID, stateManager]);

  // Trigger search when "starred" query param changes
  useEffect(() => {
    stateManager.onSetStarred(search.has('starred'));
  }, [search, stateManager]);

  useEffect(() => {
    // Clear the search results when we leave SearchView to prevent old results flashing
    // when starting a new search
    if (!isSearching && searchState.result) {
      stateManager.setState({ result: undefined, includePanels: undefined });
    }
    if (isSearching && searchState.result?.totalRows === 0) {
      reportInteraction('grafana_empty_state_shown', { source: 'browse_dashboards' });
    }
  }, [isSearching, searchState.result, stateManager]);

  // Emit exposure event for A/A test once when page loads
  const hasEmittedExposureEvent = useRef(false);

  useEffect(() => {
    if (!isRecentlyViewedEnabled || hasEmittedExposureEvent.current) {
      return;
    }

    hasEmittedExposureEvent.current = true;
    const isExperimentTreatment = isExperimentRecentlyViewedDashboards;

    reportInteraction('dashboards_browse_list_viewed', {
      experiment_dashboard_list_recently_viewed: isExperimentTreatment ? 'treatment' : 'control',
      has_recently_viewed_component: isExperimentTreatment,
    });
  }, [isRecentlyViewedEnabled, isExperimentRecentlyViewedDashboards]);

  const { data: folderDTO } = useGetFolderQueryFacade(folderUID);
  const [saveFolder] = useUpdateFolder();
  const navModel = useMemo(() => {
    if (!folderDTO) {
      return undefined;
    }
    const model = buildNavModel(folderDTO);

    // Set the "Dashboards" tab to active
    const dashboardsTabID = getDashboardsTabID(folderDTO.uid);
    const dashboardsTab = model.children?.find((child) => child.id === dashboardsTabID);
    if (dashboardsTab) {
      dashboardsTab.active = true;
    }
    return model;
  }, [folderDTO]);

  const hasSelection = useHasSelection();

  // Fetch the root (aka general) folder if we're not in a specific folder
  const { data: rootFolderDTO } = useGetFolderQueryFacade(folderDTO ? undefined : 'general');
  const folder = folderDTO ?? rootFolderDTO;

  const { canEditFolders, canDeleteFolders, canDeleteDashboards, canEditDashboards } = getFolderPermissions(folder);
  const isProvisionedFolder = folder?.managedBy === ManagerKind.Repo;
  const isRepoRootFolder = isProvisionedFolder && folderUID === repository?.name;
  const [showRenameDrawer, setShowRenameDrawer] = useState(false);
  const showEditTitle = canEditFolders && !!folderUID;
  const permissions = {
    canEditFolders,
    canEditDashboards,
    canDeleteFolders,
    canDeleteDashboards,
    isReadOnlyRepo,
  };
  const onEditTitle = async (newValue: string) => {
    if (folderDTO) {
      const result = await saveFolder({
        ...folderDTO,
        title: newValue,
      });
      if ('error' in result) {
        reportInteraction('grafana_browse_dashboards_page_edit_folder_name', {
          status: 'failed_with_error',
        });
        throw result.error;
      } else {
        reportInteraction('grafana_browse_dashboards_page_edit_folder_name', { status: 'success' });
      }
    } else {
      reportInteraction('grafana_browse_dashboards_page_edit_folder_name', { status: 'failed_no_folderDTO' });
    }
  };

  const renderTitle = (title: string) => {
    return (
      <Stack alignItems={'center'} gap={2}>
        <Text element={'h1'}>{title}</Text>
        {showEditTitle && isProvisionedFolder && !isRepoRootFolder && !isReadOnlyRepo && (
          <IconButton
            name="pen"
            size="lg"
            tooltip={t('browse-dashboards.action.rename-provisioned-folder', 'Rename provisioned folder')}
            onClick={() => setShowRenameDrawer(true)}
          />
        )}
        <FolderRepo folder={folder} />
      </Stack>
    );
  };

  return (
    <Page
      navId="dashboards/browse"
      pageNav={navModel}
      onEditTitle={showEditTitle && !isProvisionedFolder ? onEditTitle : undefined}
      renderTitle={renderTitle}
      actions={<FolderDetailsActions folderDTO={folderDTO} />}
    >
      <Page.Contents className={styles.pageContents}>
        <ProvisionedFolderPreviewBanner queryParams={queryParams} />

        {/* Only shown when viewing a folder (not root) whose managing repository has been deleted — the folder still has ownership annotations pointing to a repo that no longer exists. */}
        {repoViewStatus === RepoViewStatus.Orphaned && orphanedRepoName && (
          <OrphanedResourceBanner repositoryName={orphanedRepoName} />
        )}
        <QuotaLimitBanner />
        {isProvisionedFolder && folderUID && folder?.url && (
          <FolderReadmeHint folderUID={folderUID} folderUrl={folder.url} />
        )}
        {/* only show recently viewed dashboards when in root and flag is enabled */}
        {isRecentlyViewedEnabled && <RecentlyViewedDashboards />}
        <div>
          <FilterInput
            placeholder={getSearchPlaceholder(searchState.includePanels)}
            value={searchState.query}
            escapeRegex={false}
            onChange={(e) => stateManager.onQueryChange(e)}
          />
        </div>

        {hasSelection ? <BrowseActions folderDTO={folderDTO} /> : <BrowseFilters />}

        <div className={styles.subView}>
          <AutoSizer>
            {({ width, height }: Size) =>
              isSearching ? (
                <SearchView
                  permissions={permissions}
                  width={width}
                  height={height}
                  searchState={searchState}
                  searchStateManager={stateManager}
                />
              ) : (
                <BrowseView
                  permissions={permissions}
                  width={width}
                  height={height}
                  folderUID={folderUID}
                  isReadOnlyRepo={isReadOnlyRepo}
                />
              )
            }
          </AutoSizer>
        </div>
        {config.featureToggles.dashboardTemplates && <TemplateDashboardModal />}
      </Page.Contents>
      {showRenameDrawer && folderDTO && (
        <Drawer
          title={
            <Text variant="h3" element="h2">
              {t('browse-dashboards.action.rename-provisioned-folder', 'Rename provisioned folder')}
            </Text>
          }
          subtitle={folderDTO.title}
          onClose={() => setShowRenameDrawer(false)}
        >
          <RenameProvisionedFolderForm folder={folderDTO} onDismiss={() => setShowRenameDrawer(false)} />
        </Drawer>
      )}
    </Page>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  pageContents: css({
    label: 'pageContents',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '100%',
  }),

  // AutoSizer needs an element to measure the full height available
  subView: css({
    label: 'subView',
    height: '100%',
    minHeight: '300px',
  }),
});

BrowseDashboardsPage.displayName = 'BrowseDashboardsPage';
export default BrowseDashboardsPage;
