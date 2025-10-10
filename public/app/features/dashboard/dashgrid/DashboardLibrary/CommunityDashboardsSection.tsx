import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, useStyles2, Text, Box, Stack, Grid, Badge, LinkButton } from '@grafana/ui';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { CommunityDashboardImportDrawer } from './CommunityDashboardImportDrawer';
import { DashboardLibraryInteractions } from './interactions';
import { GnetDashboard, GnetDashboardListResponse } from './types';

/**
 * Format download count to human-readable format (e.g., 2.3K, 1.5M)
 */
function formatDownloads(downloads: number): string {
  if (downloads >= 1000000) {
    return `${(downloads / 1000000).toFixed(1)}M`;
  }
  if (downloads >= 1000) {
    return `${(downloads / 1000).toFixed(1)}K`;
  }
  return downloads.toString();
}

/**
 * CommunityDashboardsSection displays popular community dashboards from grafana.com
 * in the empty dashboard state to help users get started quickly.
 */
export const CommunityDashboardsSection = () => {
  const [selectedDashboard, setSelectedDashboard] = useState<GnetDashboard | null>(null);

  //Get datasources types configured in the instance

  const configuredDatasourceTypes = useMemo(() => {
    const datasources = getDataSourceSrv().getList();
    const types = datasources.map((ds) => ds.type);
    return [...new Set(types)];
  }, []);

  console.log('configuredDatasourceTypes', configuredDatasourceTypes);

  const { value: communityDashboards, loading } = useAsync(async (): Promise<GnetDashboard[]> => {
    try {
      const response = await getBackendSrv().get<GnetDashboardListResponse>(
        '/api/gnet/dashboards?orderBy=downloads&direction=desc&page=1&pageSize=8&includeScreenshots=true'
      );

      if (response.items.length > 0) {
        // Track analytics for community dashboards section load
        DashboardLibraryInteractions.loaded({
          numberOfItems: response.items.length,
          contentKinds: ['community_dashboard'],
          datasourceTypes: response.items.flatMap((d) => d.datasourceSlugs),
          sourceEntryPoint: 'create_dashboard',
        });
      }

      return response.items;
    } catch (error) {
      // Fail silently - don't break the empty dashboard UI if gnet API is unavailable
      console.error('Failed to fetch community dashboards:', error);
      return [];
    }
  }, []);

  // sort dashboards, show relevant dashboards first from configured datasources

  const sortedDashboards = useMemo(() => {
    if (!communityDashboards) {
      return [];
    }
    return [
      ...communityDashboards.sort((a, b) => {
        // Check if dashboard uses any of the user's configured datasources
        const aMatches = a.datasourceSlugs.some((slug) => configuredDatasourceTypes.includes(slug));
        const bMatches = b.datasourceSlugs.some((slug) => configuredDatasourceTypes.includes(slug));

        // Dashboards matching user's datasources come first
        if (aMatches && !bMatches) {
          return -1;
        }
        if (!aMatches && bMatches) {
          return 1;
        }

        // Maintain download order for ties
        return 0;
      }),
    ];
  }, [communityDashboards, configuredDatasourceTypes]);

  console.log('sortedDashboards', sortedDashboards);

  const onImportDashboardClick = async (dashboard: GnetDashboard) => {
    // Track analytics for dashboard click
    DashboardLibraryInteractions.itemClicked({
      contentKind: 'community_dashboard',
      datasourceTypes: dashboard.datasourceSlugs,
      libraryItemId: String(dashboard.id),
      libraryItemTitle: dashboard.name,
      sourceEntryPoint: 'create_dashboard',
    });

    // Check if dashboard requires datasource configuration
    try {
      const gnetDashboard = await getBackendSrv().get(`/api/gnet/dashboards/${dashboard.id}`);
      const json = gnetDashboard.json;

      // Check if there are datasource inputs that need configuration
      const hasDatasourceInputs =
        json.__inputs &&
        Array.isArray(json.__inputs) &&
        json.__inputs.some((input: { type: string }) => input.type === 'datasource');

      if (hasDatasourceInputs) {
        // Open drawer for datasource mapping
        setSelectedDashboard(dashboard);
      } else {
        // Navigate directly to template route without drawer
        navigateToTemplate(dashboard);
      }
    } catch (error) {
      console.error('Failed to check dashboard inputs:', error);
      // On error, open drawer anyway as fallback
      setSelectedDashboard(dashboard);
    }
  };

  const navigateToTemplate = (dashboard: GnetDashboard, datasourceMappings?: Record<string, string>) => {
    const params = new URLSearchParams({
      gnetId: String(dashboard.id),
      title: dashboard.name,
      sourceEntryPoint: 'create_dashboard',
      libraryItemId: String(dashboard.id),
      creationOrigin: 'dashboard_library_community_dashboard',
    });

    // Add datasource mappings if provided
    if (datasourceMappings) {
      Object.entries(datasourceMappings).forEach(([key, value]) => {
        params.append(`ds_${key}`, value);
      });
    }

    const templateUrl = `${DASHBOARD_LIBRARY_ROUTES.Template}?${params.toString()}`;
    locationService.push(templateUrl);
  };

  // Don't show section if loading or no dashboards
  if (loading || !communityDashboards?.length) {
    return null;
  }

  return (
    <>
      <Box borderColor="strong" borderStyle="dashed" padding={3} flex={1}>
        <Stack direction="column" alignItems="center" gap={2}>
          <Text element="h3" textAlignment="center" weight="medium">
            <Trans i18nKey="dashboard.empty.start-with-popular-community-dashboard">
              Start with a popular community dashboard
            </Trans>
          </Text>
          <Text element="p" textAlignment="center" color="secondary">
            <Trans i18nKey="dashboard.empty.community-dashboard-description">
              Browse templates created by the Grafana community
            </Trans>
          </Text>
          <Grid gap={3} minColumnWidth={21}>
            {sortedDashboards.map((dashboard, index) => (
              <CommunityDashboardBox
                key={dashboard.id}
                index={index}
                dashboard={dashboard}
                onImportClick={onImportDashboardClick}
                configuredDatasourceTypes={configuredDatasourceTypes}
              />
            ))}
          </Grid>
          <LinkButton
            href="https://grafana.com/grafana/dashboards"
            target="_blank"
            rel="noopener noreferrer"
            icon="external-link-alt"
            variant="secondary"
            fill="text"
          >
            <Trans i18nKey="dashboard.empty.browse-more-dashboards">Browse more dashboards on grafana.com</Trans>
          </LinkButton>
        </Stack>
      </Box>
      {selectedDashboard && (
        <CommunityDashboardImportDrawer
          dashboard={selectedDashboard}
          onClose={() => setSelectedDashboard(null)}
          onSubmit={(mappings) => {
            navigateToTemplate(selectedDashboard, mappings);
            setSelectedDashboard(null);
          }}
        />
      )}
    </>
  );
};

function getBoxStyles(theme: GrafanaTheme2) {
  return {
    communityDashboardBox: css({
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      alignItems: 'stretch',
    }),
    imageContainer: css({
      position: 'relative',
      width: '100%',
      aspectRatio: '1.18', // Maintain 177:150 aspect ratio
      overflow: 'hidden',
    }),
    dashboardSection: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      flex: 1,
      alignItems: 'center',
    }),
    dashboardTitle: css({
      width: '100%',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    }),
    dashboardImage: css({
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      borderRadius: theme.shape.radius.default,
    }),
    placeholderImage: css({
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    }),
    datasourceTypeOverlay: css({
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: theme.spacing(0.5, 1),
      backgroundColor: theme.colors.background.canvas,
      borderBottomLeftRadius: theme.shape.radius.default,
      borderBottomRightRadius: theme.shape.radius.default,
      opacity: 0.9,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      minHeight: theme.spacing(3),
    }),
  };
}

const CommunityDashboardBox = ({
  dashboard,
  onImportClick,
  index,
  configuredDatasourceTypes,
}: {
  dashboard: GnetDashboard;
  onImportClick: (d: GnetDashboard) => void;
  index: number;
  configuredDatasourceTypes: string[];
}) => {
  const styles = useStyles2(getBoxStyles);

  // Check if dashboard matches user's configured datasources
  const matchesUserDatasources = dashboard.datasourceSlugs.some((slug) => configuredDatasourceTypes.includes(slug));

  // Get the main screenshot or first screenshot if available
  const screenshot = dashboard.screenshots?.find((s) => s.mainScreenshot) || dashboard.screenshots?.[0];
  const screenshotUrl = screenshot?.links.find((l) => l.rel === 'image')?.href;

  // Debug: log screenshot data to console (remove after debugging)
  console.log(`Dashboard ${index} (${dashboard.name}):`, {
    hasScreenshots: !!dashboard.screenshots?.length,
    screenshotCount: dashboard.screenshots?.length || 0,
    selectedScreenshot: screenshot,
    screenshotUrl: screenshotUrl,
    fullImageSrc: screenshotUrl ? `/api/gnet/${screenshotUrl}` : null,
  });

  return (
    <div className={styles.communityDashboardBox}>
      <div className={styles.imageContainer}>
        {screenshotUrl ? (
          <img
            src={`/api/gnet/${screenshotUrl}`}
            alt={dashboard.name}
            className={styles.dashboardImage}
            onError={(e) => {
              console.error(`Failed to load image for ${dashboard.name}:`, `/api/gnet/${screenshotUrl}`);
              // Hide broken image
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          // Fallback placeholder if no screenshot available
          <div className={styles.placeholderImage}>
            <Text color="secondary">
              <Trans i18nKey="dashboard.empty.no-preview">No preview available</Trans>
            </Text>
          </div>
        )}
        {dashboard.datasourceSlugs && dashboard.datasourceSlugs.length > 0 && (
          <div className={styles.datasourceTypeOverlay}>
            <Text element="span" variant="bodySmall" color="secondary">
              {dashboard.datasourceSlugs.join(', ')}
            </Text>
          </div>
        )}
      </div>
      <div className={styles.dashboardSection}>
        <div className={styles.dashboardTitle}>
          <Text element="p" textAlignment="center" truncate>
            {dashboard.name}
          </Text>
          <Text element="span" variant="bodySmall" color="secondary" textAlignment="center">
            <Trans i18nKey="dashboard.empty.downloads-count">
              {{ count: formatDownloads(dashboard.downloads) }} downloads
            </Trans>
          </Text>
        </div>
        {matchesUserDatasources && (
          <Badge
            color="green"
            icon="check"
            text={t('dashboard.empty.matches-datasources', 'Matches your datasources')}
          />
        )}
        <Button fill="outline" onClick={() => onImportClick(dashboard)} size="sm">
          <Trans i18nKey="dashboard.empty.use-template-button">Use this dashboard</Trans>
        </Button>
      </div>
    </div>
  );
};

// Removed getStyles function - no longer needed with Grid component
