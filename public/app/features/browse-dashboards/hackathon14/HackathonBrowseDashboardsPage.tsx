import { css } from '@emotion/css';
import { memo, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Stack, Text, Box, Card } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
import SparkJoyToggle from 'app/core/components/SparkJoyToggle';
import { 
  useGetRecentDashboardsAndFolders, 
  useGetPopularDashboards, 
  useGetPopularFolders 
} from 'app/features/dashboard/api/popularResourcesApi';

import { useSearchStateManager } from '../../search/state/SearchStateManager';

import { AIRecommendedDashboards } from './AIRecommendedDashboards';
import { CosmicSceneIcon } from './CosmicSceneIcon';
import { HackathonSearchInput } from './HackathonSearchInput';
import { MostPopularDashboards } from './MostPopularDashboards';
import { MostPopularFolders } from './MostPopularFolders';
import { RecentVisited } from './RecentVisited';
import { SearchResults } from './SearchResults';



// Content section that shows fun empty state or the three components
const ContentSection = () => {
  const styles = useStyles2(getContentStyles);
  
  // Check all three data sources
  const { data: recentData, isLoading: recentLoading } = useGetRecentDashboardsAndFolders({ limit: 4, period: '30d' });
  const { data: popularDashboards, isLoading: dashboardsLoading } = useGetPopularDashboards({ limit: 4, period: '30d' });
  const { data: popularFolders, isLoading: foldersLoading } = useGetPopularFolders({ limit: 4, period: '30d' });

  const isLoading = recentLoading || dashboardsLoading || foldersLoading;
  
  // Check if all three are empty
  const allEmpty = 
    (!recentData || recentData.resources === null) &&
    (!popularDashboards || popularDashboards.resources === null) &&
    (!popularFolders || popularFolders.resources === null);

  if (isLoading) {
    return (
      <div className={styles.contentContainer}>
        <Text>Loading your dashboard universe...</Text>
      </div>
    );
  }

  if (allEmpty) {
    return (
      <Box marginTop={4}>
          <Stack direction="column" gap={4} alignItems="center">
            {/* Cosmic empty state illustration */}

            {/* Welcome message */}
            {/* <Stack direction="column" gap={2} alignItems="center">
              <Text variant="h3">Welcome to Your Dashboard Universe!</Text>
              <div className={styles.subtitle}>
                <Text color="secondary" textAlignment="center">
                  Your journey starts here. The cosmos of data visualization awaits.
                </Text>
              </div>
            </Stack> */}

            <AIRecommendedDashboards />

            {/* Getting started cards */}
            <div className={styles.actionCards}>
              <Card className={styles.actionCard} onClick={() => window.location.href = '/dashboards'}>
                <Stack direction="column" gap={1} alignItems="center">
                  <Text variant="h5">🗺️ Explore Dashboards</Text>
                  <Text variant="bodySmall" color="secondary" textAlignment="center">
                    Browse existing dashboards and folders
                  </Text>
                </Stack>
              </Card>

              <Card className={styles.actionCard} onClick={() => window.location.href = '/dashboard/new'}>
                <Stack direction="column" gap={1} alignItems="center">
                  <Text variant="h5">✨ Create Dashboard</Text>
                  <Text variant="bodySmall" color="secondary" textAlignment="center">
                    Build a new dashboard with visualizations
                  </Text>
                </Stack>
              </Card>
            </div>

            {/* Tip */}
            <Card className={styles.funFactCard}>
              <Stack direction="row" gap={2} alignItems="center">
                <Text variant="h6">💡</Text>
                <Text variant="bodySmall">
                  <strong>Tip:</strong> Your recently visited dashboards and folders will appear on this page
                </Text>
              </Stack>
            </Card>

            <CosmicSceneIcon />
          </Stack>
      </Box>
    );
  }

  // Show the AI and other components normally
  return (
    <div className={styles.contentContainer}>
      <RecentVisited />
      <MostPopularFolders />
      <MostPopularDashboards />
    </div>
  );
};

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
            <SearchResults searchState={searchState} query={searchState.query || ''} />
          </div>
        ) : (
          <ContentSection />
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

const getContentStyles = (theme: GrafanaTheme2) => ({
  contentContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    padding: theme.spacing(2),
    maxWidth: '1000px',
    margin: '0 auto',
  }),

  emptyUniverseCard: css({
    padding: theme.spacing(8),
    background: `radial-gradient(circle at 50% 50%, ${theme.colors.background.secondary}, ${theme.colors.background.canvas})`,
    border: `1px solid ${theme.colors.border.weak}`,
  }),

  cosmicScene: css({
    position: 'relative',
    width: '200px',
    height: '200px',
    margin: '0 auto',
  }),

  planet: css({
    position: 'absolute',
    fontSize: '80px',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    animation: 'spin 20s linear infinite',
    '@keyframes spin': {
      from: { transform: 'translate(-50%, -50%) rotate(0deg)' },
      to: { transform: 'translate(-50%, -50%) rotate(360deg)' },
    },
  }),

  star1: css({
    position: 'absolute',
    fontSize: '24px',
    top: '20%',
    left: '15%',
    animation: 'twinkle 2s ease-in-out infinite',
    '@keyframes twinkle': {
      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
      '50%': { opacity: 0.4, transform: 'scale(0.8)' },
    },
  }),

  star2: css({
    position: 'absolute',
    fontSize: '20px',
    top: '30%',
    right: '10%',
    animation: 'twinkle 2.5s ease-in-out infinite 0.5s',
  }),

  star3: css({
    position: 'absolute',
    fontSize: '22px',
    bottom: '25%',
    left: '20%',
    animation: 'twinkle 3s ease-in-out infinite 1s',
  }),

  rocket: css({
    position: 'absolute',
    fontSize: '32px',
    top: '10%',
    right: '20%',
    animation: 'float 4s ease-in-out infinite',
    '@keyframes float': {
      '0%, 100%': { transform: 'translateY(0px) rotate(-15deg)' },
      '50%': { transform: 'translateY(-20px) rotate(-15deg)' },
    },
  }),

  subtitle: css({
    maxWidth: '600px',
  }),

  actionCards: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing(2),
    width: '100%',
    maxWidth: '600px',
  }),

  actionCard: css({
    padding: theme.spacing(3),
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: `1px solid ${theme.colors.border.medium}`,
    backgroundColor: theme.colors.background.secondary,
    
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.shadows.z2,
      borderColor: theme.colors.primary.border,
    },
  }),

  funFactCard: css({
    padding: theme.spacing(2, 3),
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    maxWidth: '600px',
  }),
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
});

HackathonBrowseDashboardsPage.displayName = 'HackathonBrowseDashboardsPage';
export default HackathonBrowseDashboardsPage;
