import { css } from '@emotion/css';
import { memo, useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { LinkButton, FilterInput, useStyles2, Text, Stack } from '@grafana/ui';
import { useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { Page } from 'app/core/components/Page/Page';
import { getConfig } from 'app/core/config';
import { useDispatch } from 'app/types/store';

import { FolderRepo } from '../../core/components/NestedFolderPicker/FolderRepo';
import { contextSrv } from '../../core/services/context_srv';
import { ManagerKind } from '../apiserver/types';
import { buildNavModel, getDashboardsTabID } from '../folders/state/navModel';
import { useGetResourceRepositoryView } from '../provisioning/hooks/useGetResourceRepositoryView';
import { useSearchStateManager } from '../search/state/SearchStateManager';
import { getSearchPlaceholder } from '../search/tempI18nPhrases';

import { useSaveFolderMutation } from './api/browseDashboardsAPI';
import { BrowseActions } from './components/BrowseActions/BrowseActions';
import { BrowseFilters } from './components/BrowseFilters';
import { BrowseView } from './components/BrowseView';
import CreateNewButton from './components/CreateNewButton';
import { FolderActionsButton } from './components/FolderActionsButton';
import { ProvisionedFolderPreviewBanner } from './components/ProvisionedFolderPreviewBanner';
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
  const { isReadOnlyRepo, repoType } = useGetResourceRepositoryView({ folderName: folderUID });

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

  const { data: folderDTO } = useGetFolderQueryFacade(folderUID);
  const [saveFolder] = useSaveFolderMutation();
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

  const {
    canEditFolders,
    canDeleteFolders,
    canDeleteDashboards,
    canEditDashboards,
    canCreateDashboards,
    canCreateFolders,
  } = getFolderPermissions(folder);
  const hasAdminRights = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;
  const isProvisionedFolder = folder?.managedBy === ManagerKind.Repo;
  const showEditTitle = canEditFolders && folderUID && !isProvisionedFolder;
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

  const handleButtonClickToRecentlyDeleted = () => {
    reportInteraction('grafana_browse_dashboards_page_button_to_recently_deleted', {
      origin: window.location.pathname === getConfig().appSubUrl + '/dashboards' ? 'Dashboards' : 'Folder view',
    });
  };

  const renderTitle = (title: string) => {
    return (
      <Stack alignItems={'center'} gap={2}>
        <Text element={'h1'}>{title}</Text> <FolderRepo folder={folder} />
      </Stack>
    );
  };

  return (
    <Page
      navId="dashboards/browse"
      pageNav={navModel}
      onEditTitle={showEditTitle ? onEditTitle : undefined}
      renderTitle={renderTitle}
      actions={
        <>
          {config.featureToggles.restoreDashboards && hasAdminRights && (
            <LinkButton
              variant="secondary"
              href={getConfig().appSubUrl + '/dashboard/recently-deleted'}
              onClick={handleButtonClickToRecentlyDeleted}
            >
              <Trans i18nKey="browse-dashboards.actions.button-to-recently-deleted">Recently deleted</Trans>
            </LinkButton>
          )}
          {folderDTO && <FolderActionsButton folder={folderDTO} repoType={repoType} isReadOnlyRepo={isReadOnlyRepo} />}
          {(canCreateDashboards || canCreateFolders) && (
            <CreateNewButton
              parentFolder={folderDTO}
              canCreateDashboard={canCreateDashboards}
              canCreateFolder={canCreateFolders}
              repoType={repoType}
              isReadOnlyRepo={isReadOnlyRepo}
            />
          )}
        </>
      }
    >
      <Page.Contents className={styles.pageContents}>
        <ProvisionedFolderPreviewBanner queryParams={queryParams} />
        <div>
          <FilterInput
            placeholder={getSearchPlaceholder(searchState.includePanels)}
            value={searchState.query}
            escapeRegex={false}
            onChange={(e) => stateManager.onQueryChange(e)}
          />
        </div>

        {hasSelection ? (
          <BrowseActions folderDTO={folderDTO} />
        ) : (
          <div className={styles.filters}>
            <BrowseFilters />
          </div>
        )}

        <div className={styles.subView}>
          <AutoSizer>
            {({ width, height }) =>
              isSearching ? (
                <SearchView
                  permissions={permissions}
                  width={width}
                  height={height}
                  searchState={searchState}
                  searchStateManager={stateManager}
                />
              ) : (
                <BrowseView permissions={permissions} width={width} height={height} folderUID={folderUID} />
              )
            }
          </AutoSizer>
        </div>
      </Page.Contents>
    </Page>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  pageContents: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '100%',
  }),

  // AutoSizer needs an element to measure the full height available
  subView: css({
    height: '100%',
  }),

  filters: css({
    display: 'none',

    [theme.breakpoints.up('md')]: {
      display: 'block',
    },
  }),
});

BrowseDashboardsPage.displayName = 'BrowseDashboardsPage';
export default BrowseDashboardsPage;
