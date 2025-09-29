import { css } from '@emotion/css';
import { memo, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Card, Button, Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useSearchStateManager } from '../../search/state/SearchStateManager';
import { HackathonSearchInput } from './HackathonSearchInput';
import SparkJoyToggle from 'app/core/components/SparkJoyToggle';
import { MostPopularDashboards } from './MostPopularDashboards';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';

// New Browse/Manage/Search Dashboards views for nested folders
const HackathonBrowseDashboardsPage = memo(
  ({ queryParams, onToggleSparkJoy }: { queryParams: Record<string, string>; onToggleSparkJoy: () => void }) => {
    const styles = useStyles2(getStyles);
    const [searchState, stateManager] = useSearchStateManager();
    const isSearching = stateManager.hasSearchFilters();

    const renderCenteredTitle = (title: string) => (
      <div className={styles.centeredTitle}>
        <h1>{title}</h1>
      </div>
    );

    // Trigger search when component mounts to get initial results
    useEffect(() => {
      stateManager.initStateFromUrl(undefined, false);
    }, [stateManager]);

    const handleSearch = (value: string) => {
      stateManager.onQueryChange(value);
    };

    const triggerSearch = () => {
      if (searchState.query) {
        stateManager.setStateAndDoSearch({});
      }
    };

    // Render search results as simple list
    const renderSearchResults = () => {
      if (searchState.loading) {
        return <Text>Loading...</Text>;
      }

      if (!searchState.result) {
        return <Text>No search performed yet. Placeholder here.</Text>;
      }

      const results = [];
      const view = searchState.result.view;

      for (let i = 0; i < Math.min(view.length, 20); i++) {
        // Limit to first 20 results
        const item = view.get(i);
        results.push(item);
      }

      if (results.length === 0) {
        return <Text>No results found for "{searchState.query}"</Text>;
      }

      return (
        <div className={styles.results}>
          {/* Simple text format */}
          <div className={styles.textResults}>
            <Text weight="medium">Plain Text Format:</Text>
            {results.map((item, index) => (
              <div key={`${item.uid}-${index}`} className={styles.resultItem}>
                <Text>
                  {index + 1}. <strong>{item.name}</strong> ({item.kind}){item.location && ` - ${item.location}`}
                  {item.tags?.length > 0 && ` - Tags: ${item.tags.join(', ')}`}
                  {item.url && ` - URL: ${item.url}`}
                </Text>
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <Page
        navId="dashboards/browse"
        // pageNav={navModel}
        // onEditTitle={showEditTitle ? onEditTitle : undefined}
        renderTitle={renderCenteredTitle}
        subTitle=""
        actions={
          <AppChromeUpdate
            actions={[<SparkJoyToggle key="sparks-joy-toggle" value={true} onToggle={onToggleSparkJoy} />]}
          />
        }
        // actions={
        //   <>
        //     {config.featureToggles.restoreDashboards && hasAdminRights && (
        //       <LinkButton
        //         variant="secondary"
        //         href={getConfig().appSubUrl + '/dashboard/recently-deleted'}
        //         onClick={handleButtonClickToRecentlyDeleted}
        //       >
        //         <Trans i18nKey="browse-dashboards.actions.button-to-recently-deleted">Recently deleted</Trans>
        //       </LinkButton>
        //     )}
        //     {folderDTO && <FolderActionsButton folder={folderDTO} repoType={repoType} isReadOnlyRepo={isReadOnlyRepo} />}
        //     {(canCreateDashboards || canCreateFolders) && (
        //       <CreateNewButton
        //         parentFolder={folderDTO}
        //         canCreateDashboard={canCreateDashboards}
        //         canCreateFolder={canCreateFolders}
        //         repoType={repoType}
        //         isReadOnlyRepo={isReadOnlyRepo}
        //       />
        //     )}
        //   </>
        // }
      >
        <HackathonSearchInput onSearchChange={handleSearch} placeholder="Search for dashboards and folders" />

        {isSearching ? (
          <div className={styles.contentContainer}>
            <div className={styles.container}>
              <Stack>
                <Text variant="h3">Search Results: "{searchState.query || 'none'}"</Text>
              </Stack>
              <Card className={styles.resultsCard}>{renderSearchResults()}</Card>
            </div>
          </div>
        ) : (
          <div className={styles.contentContainer}>
            <MostPopularDashboards />
          </div>
        )}
        {/* <Page.Contents className={styles.pageContents}>
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
      </Page.Contents> */}
      </Page>
    );
  }
);

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

  centeredTitle: css({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    h1: {
      marginBottom: 0,
      textAlign: 'center',
    },
  }),

  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    padding: theme.spacing(2),
    maxWidth: '1200px',
    margin: '0 auto',
  }),

  contentContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    padding: theme.spacing(2),
    maxWidth: '1000px',
    margin: '0 auto',
  }),

  resultsCard: css({
    padding: theme.spacing(3),
    maxHeight: '70vh',
    overflow: 'auto',
  }),

  results: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),

  textResults: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  }),

  resultItem: css({
    padding: theme.spacing(1),
    borderLeft: `3px solid ${theme.colors.primary.main}`,
    paddingLeft: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
  }),

  jsonResults: css({
    marginTop: theme.spacing(2),
  }),

  jsonPre: css({
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(2),
    fontSize: theme.typography.bodySmall.fontSize,
    overflow: 'auto',
    maxHeight: '400px',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  }),
});

HackathonBrowseDashboardsPage.displayName = 'HackathonBrowseDashboardsPage';
export default HackathonBrowseDashboardsPage;
