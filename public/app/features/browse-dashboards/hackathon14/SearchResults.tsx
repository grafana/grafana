import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2, Card, Stack, Text, Button, ButtonGroup, Grid, Icon, Spinner, useTheme2, Badge, LinkButton } from '@grafana/ui';

import { CosmicSceneIcon } from './CosmicSceneIcon';
import { SearchResultAIRecommendation } from './SearchResultAIRecommendation';
import { SearchResultSuggestion } from './SearchResultSuggestion';
import { HackathonTable, TableColumn, ExpandedContent } from './HackathonTable';

interface SearchResultsProps {
  searchState: any;
  query: string;
}

export const SearchResults = ({ searchState, query }: SearchResultsProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [viewMode, setViewMode] = useState<'thumbnail' | 'list'>('thumbnail');
  const [activeTab, setActiveTab] = useState<'dashboards' | 'folders'>('dashboards');

  // Helper to get thumbnail URL
  const getThumbnailUrl = (item: any) => {
    if (item.kind !== 'dashboard') {
      return null;
    }

    if (!config.rendererAvailable) {
      return null;
    }

    const params = new URLSearchParams({
      width: '1920',
      height: '1080',
      scale: '1',
      theme: theme.isDark ? 'dark' : 'light',
      kiosk: '1',
      timeout: '60',
    });

    return `${config.appSubUrl}/render/d/${item.uid}?${params.toString()}`;
  };

  // Thumbnail component for dashboards
  const DashboardThumbnail = ({ url, alt }: { url: string; alt: string }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    return (
      <div className={styles.thumbnailWrapper}>
        {imageLoading && !imageError && (
          <div className={styles.thumbnailLoading}>
            <Spinner />
            <Text variant="bodySmall" color="secondary">
              Rendering preview...
            </Text>
          </div>
        )}
        {imageError && (
          <div className={styles.thumbnailError}>
            <Icon name="apps" size="xxl" />
            <Text variant="bodySmall" color="secondary">
              {!config.rendererAvailable ? 'Image renderer not installed' : 'Preview unavailable'}
            </Text>
          </div>
        )}
        <img
          src={url}
          alt={alt}
          className={styles.thumbnailImage}
          style={{ display: imageLoading || imageError ? 'none' : 'block' }}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageLoading(false);
            setImageError(true);
          }}
        />
      </div>
    );
  };

  // Table column configuration for list view
  const getColumns = (): TableColumn[] => {
    if (activeTab === 'dashboards') {
      return [
        {
          key: 'name',
          header: 'Name',
          width: '2.5fr',
          render: (item) => (
            <Stack direction="row" gap={1.5} alignItems="center">
              <Icon name="apps" size="lg" />
              <Text weight="medium">{item.name}</Text>
            </Stack>
          ),
        },
        {
          key: 'details',
          header: 'Details',
          width: '2fr',
          render: (item) =>
            item.tags && item.tags.length > 0 ? (
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Text variant="bodySmall" color="secondary">
                  Tags: {item.tags.slice(0, 3).join(', ')}
                </Text>
              </div>
            ) : (
              <Text variant="bodySmall" color="secondary">
                Dashboard
              </Text>
            ),
        },
        {
          key: 'location',
          header: 'Location',
          width: '1.5fr',
          render: (item) =>
            item.location ? (
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="folder-open" size="sm" />
                <Text variant="bodySmall" color="secondary">
                  {item.location}
                </Text>
              </Stack>
            ) : (
              <Text variant="bodySmall" color="secondary">
                General
              </Text>
            ),
        },
      ];
    } else {
      // Folders
      return [
        {
          key: 'name',
          header: 'Name',
          width: '3fr',
          render: (item) => (
            <Stack direction="row" gap={1.5} alignItems="center">
              <Icon name="folder" size="lg" style={{ color: '#FFB800' }} />
              <Text weight="medium">{item.name}</Text>
            </Stack>
          ),
        },
        {
          key: 'location',
          header: 'Parent Folder',
          width: '2fr',
          render: (item) =>
            item.location ? (
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="folder-open" size="sm" />
                <Text variant="bodySmall" color="secondary">
                  {item.location}
                </Text>
              </Stack>
            ) : (
              <Text variant="bodySmall" color="secondary">
                Root
              </Text>
            ),
        },
      ];
    }
  };

  // Expanded content configuration for list view
  const expandedContent: ExpandedContent = {
    render: (item) => (
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={4}>
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              UID:
            </Text>
            <Text variant="bodySmall"> {item.uid}</Text>
          </div>
          {item.url && (
            <div>
              <Text variant="bodySmall" weight="medium" color="secondary">
                URL:
              </Text>
              <Text variant="bodySmall"> {item.url}</Text>
            </div>
          )}
        </Stack>
        {item.tags && item.tags.length > 0 && (
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              All Tags:
            </Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
              {item.tags.map((tag: string, idx: number) => (
                <Badge key={idx} text={tag} color="blue" />
              ))}
            </div>
          </div>
        )}
        <div>
          <LinkButton
            size="sm"
            variant="primary"
            href={item.url}
            onClick={(e) => e.stopPropagation()}
          >
            Open {activeTab === 'dashboards' ? 'Dashboard' : 'Folder'}
          </LinkButton>
        </div>
      </Stack>
    ),
  };

  if (searchState.loading) {
    return (
      <div className={styles.loadingState}>
        <Spinner />
        <Text>Searching...</Text>
      </div>
    );
  }

  if (!searchState.result) {
    return <Text>No search performed yet.</Text>;
  }

  const results: any[] = [];
  const view = searchState.result.view;

  for (let i = 0; i < view.length; i++) {
    const item = view.get(i);
    results.push(item);
  }

  if (results?.length === 0) {
    return (
      <div className={styles.emptyState}>
        <CosmicSceneIcon />
        <Text variant="h4">No results found</Text>
        <Text color="secondary">Try adjusting your search query or explore the cosmos 🚀</Text>
      </div>
    );
  }

  // Filter results
  const dashboards = results.filter((item) => item.kind === 'dashboard');
  const folders = results.filter((item) => item.kind === 'folder');

  const displayResults = activeTab === 'dashboards' ? dashboards : folders;

  // Check for active filters
  const hasQuery = query && query.trim().length > 0;
  const hasTags = searchState?.tag && searchState.tag.length > 0;
  const hasStarred = searchState?.starred;
  const hasOwnedByMe = searchState?.ownedByMe;

  // Generate header content
  const renderHeaderContent = () => {
    if (hasQuery && hasTags) {
      return (
        <div>
          <Text variant="h3">
            Search Results for: <span className={styles.queryText}>"{query}"</span>
          </Text>
          <div style={{ marginTop: '8px' }}>
            <Text variant="bodySmall" color="secondary">
              Filtered by {searchState.tag.length} tag{searchState.tag.length > 1 ? 's' : ''}:{' '}
              {searchState.tag.join(', ')}
            </Text>
          </div>
        </div>
      );
    }

    if (hasQuery) {
      return (
        <Text variant="h3">
          Search Results for: <span className={styles.queryText}>"{query}"</span>
        </Text>
      );
    }

    if (hasTags) {
      return (
        <div>
          <Text variant="h3">Filtered by Tags</Text>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {searchState.tag.map((tag: string) => (
              <Badge key={tag} text={tag} color="blue" />
            ))}
          </div>
        </div>
      );
    }

    if (hasStarred || hasOwnedByMe) {
      const filters = [];
      if (hasStarred) {
        filters.push('Starred');
      }
      if (hasOwnedByMe) {
        filters.push('Owned by me');
      }
      return (
        <Text variant="h3">
          Filtered Results: <span className={styles.queryText}>{filters.join(', ')}</span>
        </Text>
      );
    }

    return <Text variant="h3">All Results</Text>;
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.searchHeader}>{renderHeaderContent()}</div>

      {hasQuery && <SearchResultSuggestion searchQuery={query} />}

      {/* Tabs and Toggle */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" gap={1}>
          <Button
            variant={activeTab === 'dashboards' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('dashboards')}
            size="sm"
          >
            Dashboards
            <Badge text={dashboards.length.toString()} color="blue" className={styles.badge} />
          </Button>
          <Button
            variant={activeTab === 'folders' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('folders')}
            size="sm"
          >
            Folders
            <Badge text={folders.length.toString()} color="blue" className={styles.badge} />
          </Button>
        </Stack>

        <ButtonGroup>
          <Button
            icon="apps"
            variant={viewMode === 'thumbnail' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('thumbnail')}
            tooltip="Thumbnail view"
            size="sm"
          />
          <Button
            icon="list-ul"
            variant={viewMode === 'list' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('list')}
            tooltip="List view"
            size="sm"
          />
        </ButtonGroup>
      </Stack>

      {/* Results Display */}
      {displayResults.length === 0 ? (
        <div className={styles.emptyState}>
          <CosmicSceneIcon />
          <Text variant="h4">No {activeTab} found</Text>
          <Text color="secondary">Try a different search or browse other categories 🌟</Text>
        </div>
      ) : viewMode === 'thumbnail' ? (
        <div className={styles.resultsGrid}>
          <Grid gap={2} columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}>
            {displayResults.map((item, index) => {
              const thumbnailUrl = getThumbnailUrl(item);
              return (
                <Card
                  key={`${item.uid}-${index}`}
                  className={styles.thumbnailCard}
                  onClick={() => item.url && (window.location.href = item.url)}
                >
                  <Stack direction="column" gap={0}>
                    {thumbnailUrl && activeTab === 'dashboards' && (
                      <DashboardThumbnail url={thumbnailUrl} alt={item.name} />
                    )}
                    {!thumbnailUrl && activeTab === 'dashboards' && (
                      <div className={styles.noThumbnail}>
                        <Icon name="apps" size="xxl" />
                      </div>
                    )}
                    {activeTab === 'folders' && (
                      <div className={styles.folderThumbnail}>
                        <Icon name="folder" size="xxl" />
                      </div>
                    )}

                    <div className={styles.cardContent}>
                      <div className={styles.cardTitle}>
                        <Text weight="medium">{item.name}</Text>
                      </div>
                      {item.location && (
                        <Text variant="bodySmall" color="secondary">
                          {item.location}
                        </Text>
                      )}
                      {item.tags && item.tags.length > 0 && (
                        <Stack direction="row" gap={0.5} wrap="wrap">
                          {item.tags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} text={tag} color="blue" />
                          ))}
                        </Stack>
                      )}
                    </div>
                  </Stack>
                </Card>
              );
            })}
          </Grid>
        </div>
      ) : (
        <HackathonTable
          columns={getColumns()}
          data={displayResults}
          expandable={true}
          expandedContent={expandedContent}
          onRowClick={(item) => item.url && (window.location.href = item.url)}
          emptyMessage={`No ${activeTab} found`}
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    marginLeft: theme.spacing(6),
    marginRight: theme.spacing(6),
  }),

  searchHeader: css({
    marginBottom: theme.spacing(2),
  }),

  queryText: css({
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  }),

  badge: css({
    marginLeft: theme.spacing(1),
  }),

  loadingState: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(8),
  }),

  emptyState: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(8),
    color: theme.colors.text.secondary,
  }),

  resultsGrid: css({
    marginTop: theme.spacing(2),
  }),

  thumbnailCard: css({
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    padding: 0,
    overflow: 'hidden',
    position: 'relative',
    border: '2px solid transparent',

    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
      background: 'linear-gradient(90deg, #FF780A, #FF8C2A, #FFA040)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0,
      transition: 'opacity 0.3s ease',
      zIndex: 1,
    },

    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 16px rgba(255, 120, 10, 0.15)',

      '&::before': {
        opacity: 0.35,
      },
    },
  }),

  thumbnailWrapper: css({
    position: 'relative',
    width: '100%',
    height: '160px',
    backgroundColor: theme.colors.background.secondary,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),

  thumbnailLoading: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    height: '100%',
  }),

  thumbnailError: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    color: theme.colors.text.secondary,
  }),

  thumbnailImage: css({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }),

  noThumbnail: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '160px',
    backgroundColor: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
  }),

  folderThumbnail: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '160px',
    backgroundColor: theme.colors.background.secondary,
    color: '#FF780A',
  }),

  cardContent: css({
    padding: theme.spacing(1.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),

  cardTitle: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  listResults: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  }),

  listCard: css({
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    border: '2px solid transparent',
    padding: theme.spacing(2),

    '&::before': {
      content: '""',
      position: 'absolute',
      top: -2,
      left: -2,
      right: -2,
      bottom: -2,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
      background: 'linear-gradient(90deg, #FF780A, #FF8C2A, #FFA040)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0,
      transition: 'opacity 0.3s ease',
      zIndex: -1,
    },

    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(255, 120, 10, 0.12)',

      '&::before': {
        opacity: 0.35,
      },

      '& .quick-actions': {
        opacity: 1,
      },
    },
  }),

  listCardContent: css({
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: theme.spacing(3),
    alignItems: 'center',
  }),

  listContentSection: css({
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),

  listTitleRow: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  }),

  listTitle: css({
    fontSize: theme.typography.h5.fontSize,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  starIcon: css({
    color: '#f59e0b',
    flexShrink: 0,
  }),

  listTypeBadge: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1),
    backgroundColor: `${theme.colors.primary.main}15`,
    border: `1px solid ${theme.colors.primary.main}`,
    borderRadius: theme.shape.radius.pill,
    flexShrink: 0,
  }),

  typeBadgeIcon: css({
    color: theme.colors.primary.main,
  }),

  locationIcon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),

  location: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  metaIcon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),

  listStatsSection: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    alignItems: 'flex-end',
    flexShrink: 0,
  }),

  statItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    minWidth: '120px',
  }),

  statIcon: css({
    color: '#FF780A',
    flexShrink: 0,
  }),

  quickActions: css({
    display: 'flex',
    gap: theme.spacing(1),
    opacity: 0,
    transition: 'opacity 0.3s ease',
  }),

  actionIcon: css({
    color: '#FF780A',
    cursor: 'pointer',
    padding: theme.spacing(0.5),
    borderRadius: theme.shape.radius.default,
    transition: 'all 0.2s ease',

    '&:hover': {
      backgroundColor: theme.colors.background.secondary,
      transform: 'scale(1.1)',
    },
  }),
});
