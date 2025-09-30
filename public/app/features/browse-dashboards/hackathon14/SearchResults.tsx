import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Card, Stack, Text, Button, ButtonGroup, Grid, Icon, Spinner, useTheme2, Badge } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { CosmicSceneIcon } from './CosmicSceneIcon';

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

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.searchHeader}>
        <Text variant="h3">
          Search Results for: <span className={styles.queryText}>"{query || 'none'}"</span>
        </Text>
      </div>

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
        <div className={styles.listResults}>
          {displayResults.map((item, index) => {
            return (
              <Card
                key={`${item.uid}-${index}`}
                className={styles.listCard}
                onClick={() => item.url && (window.location.href = item.url)}
              >
                <div className={styles.listCardContent}>
                  {/* Content */}
                  <div className={styles.listContentSection}>
                    <div className={styles.listTitleRow}>
                      <Stack direction="row" gap={1} alignItems="center">
                        <div className={styles.listTitle}>
                          <Text weight="medium">{item.name}</Text>
                        </div>
                        {item.starred && (
                          <Icon name="star" size="sm" className={styles.starIcon} title="Starred" />
                        )}
                      </Stack>
                      <div className={styles.listTypeBadge}>
                        <Icon
                          name={activeTab === 'dashboards' ? 'apps' : 'folder'}
                          size="xs"
                          className={styles.typeBadgeIcon}
                        />
                        <Text variant="bodySmall">{activeTab === 'dashboards' ? 'Dashboard' : 'Folder'}</Text>
                      </div>
                    </div>

                    {item.location && (
                      <Stack direction="row" gap={0.5} alignItems="center">
                        <Icon name="folder-open" size="xs" className={styles.locationIcon} />
                        <div className={styles.location}>
                          <Text variant="bodySmall" color="secondary">
                            {item.location}
                          </Text>
                        </div>
                      </Stack>
                    )}

                    {/* Tags and metadata */}
                    <Stack direction="row" gap={2} alignItems="center" wrap="wrap">
                      {item.tags && item.tags.length > 0 && (
                        <Stack direction="row" gap={0.5} alignItems="center">
                          <Icon name="tag-alt" size="xs" className={styles.metaIcon} />
                          {item.tags.slice(0, 4).map((tag: string) => (
                            <Badge key={tag} text={tag} color="blue" />
                          ))}
                          {item.tags.length > 4 && (
                            <Text variant="bodySmall" color="secondary">
                              +{item.tags.length - 4} more
                            </Text>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </div>

                  {/* Right: Stats */}
                  <div className={styles.listStatsSection}>
                    {item.sortMeta && (
                      <div className={styles.statItem}>
                        <Icon name="eye" size="sm" className={styles.statIcon} />
                        <div>
                          <Text variant="bodySmall" color="secondary">
                            Views
                          </Text>
                          <Text weight="medium">{item.sortMeta || 'N/A'}</Text>
                        </div>
                      </div>
                    )}
                    {item.updated && (
                      <div className={styles.statItem}>
                        <Icon name="clock-nine" size="sm" className={styles.statIcon} />
                        <div>
                          <Text variant="bodySmall" color="secondary">
                            Updated
                          </Text>
                          <Text variant="bodySmall">{new Date(item.updated).toLocaleDateString()}</Text>
                        </div>
                      </div>
                    )}
                    <div className={`${styles.quickActions} quick-actions`}>
                      <Icon name="external-link-alt" size="sm" className={styles.actionIcon} title="Open" />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
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
      background: 'linear-gradient(90deg, #f59e0b, #ef4444, #ec4899, #8b5cf6, #6366f1)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0,
      transition: 'opacity 0.3s ease',
      zIndex: 1,
    },

    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 16px rgba(99, 102, 241, 0.25)',

      '&::before': {
        opacity: 0.45,
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
    color: '#ec4899',
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
      background: 'linear-gradient(90deg, #f59e0b, #ef4444, #ec4899, #8b5cf6, #6366f1)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0,
      transition: 'opacity 0.3s ease',
      zIndex: -1,
    },

    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.18)',

      '&::before': {
        opacity: 0.45,
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
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: theme.shape.radius.pill,
    flexShrink: 0,
  }),

  typeBadgeIcon: css({
    color: '#6366f1',
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
    color: '#8b5cf6',
    flexShrink: 0,
  }),

  quickActions: css({
    display: 'flex',
    gap: theme.spacing(1),
    opacity: 0,
    transition: 'opacity 0.3s ease',
  }),

  actionIcon: css({
    color: '#6366f1',
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
