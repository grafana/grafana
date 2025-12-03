/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import {
  Button,
  ConfirmModal,
  ErrorBoundaryAlert,
  Input,
  LoadingPlaceholder,
  UsersIndicator,
  useStyles2,
} from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { exploreMapApi, ExploreMapListItem } from './api/exploreMapApi';
import { useMapActiveUsers } from './hooks/useMapActiveUsers';
import { initialExploreMapState } from './state/types';

export default function ExploreMapListPage(props: GrafanaRouteComponentProps) {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const navModel = useNavModel('explore-map');
  const [maps, setMaps] = useState<ExploreMapListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmUid, setDeleteConfirmUid] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    chrome.update({
      sectionNav: navModel,
    });
  }, [chrome, navModel]);

  useEffect(() => {
    loadMaps();
  }, []);

  const loadMaps = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await exploreMapApi.listExploreMaps(100);
      setMaps(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load explore maps');
      console.error('Failed to load explore maps:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      setCreatingNew(true);
      const newMap = await exploreMapApi.createExploreMap({
        title: 'New Explore Map',
        data: initialExploreMapState,
      });
      // Navigate to the new map
      window.location.href = `/explore-maps/${newMap.uid}`;
    } catch (err) {
      console.error('Failed to create explore map:', err);
      setError(err instanceof Error ? err.message : 'Failed to create explore map');
      setCreatingNew(false);
    }
  };

  const handleDelete = async (uid: string) => {
    try {
      await exploreMapApi.deleteExploreMap(uid);
      setDeleteConfirmUid(null);
      loadMaps();
    } catch (err) {
      console.error('Failed to delete explore map:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete explore map');
    }
  };

  const filteredMaps = maps.filter((map) =>
    map.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const mapToDelete = maps.find((m) => m.uid === deleteConfirmUid);

  return (
    <ErrorBoundaryAlert>
      <div className={styles.pageWrapper}>
        <h1 className="sr-only">
          <Trans i18nKey="nav.explore-maps.title">Explore Maps</Trans>
        </h1>

        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h2 className={styles.pageTitle}>Explore Maps</h2>
            <p className={styles.pageDescription}>
              Create and manage collaborative exploration canvases with multiple panels
            </p>
          </div>
          <Button icon="plus" onClick={handleCreateNew} disabled={creatingNew}>
            {creatingNew ? 'Creating...' : 'Create new map'}
          </Button>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            <p>{error}</p>
            <Button variant="secondary" size="sm" onClick={loadMaps}>
              Retry
            </Button>
          </div>
        )}

        <div className={styles.controls}>
          <Input
            prefix={<span className="fa fa-search" />}
            placeholder="Search maps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            className={styles.searchInput}
          />
        </div>

        {loading ? (
          <LoadingPlaceholder text="Loading explore maps..." />
        ) : filteredMaps.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateContent}>
              {searchQuery ? (
                <>
                  <p className={styles.emptyStateTitle}>No maps found</p>
                  <p className={styles.emptyStateText}>Try adjusting your search query</p>
                </>
              ) : (
                <>
                  <p className={styles.emptyStateTitle}>No explore maps yet</p>
                  <p className={styles.emptyStateText}>
                    Create your first explore map to get started with collaborative exploration
                  </p>
                  <Button icon="plus" onClick={handleCreateNew} disabled={creatingNew}>
                    Create your first map
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.mapGrid}>
            {filteredMaps.map((map) => (
              <MapCard key={map.uid} map={map} onDelete={() => setDeleteConfirmUid(map.uid)} formatDate={formatDate} />
            ))}
          </div>
        )}

        {deleteConfirmUid && mapToDelete && (
          <ConfirmModal
            isOpen={true}
            title="Delete explore map"
            body={
              <>
                Are you sure you want to delete <strong>{mapToDelete.title}</strong>? This action cannot be
                undone.
              </>
            }
            confirmText="Delete"
            onConfirm={() => handleDelete(deleteConfirmUid)}
            onDismiss={() => setDeleteConfirmUid(null)}
          />
        )}
      </div>
    </ErrorBoundaryAlert>
  );
}

interface MapCardProps {
  map: ExploreMapListItem;
  onDelete: () => void;
  formatDate: (dateStr: string) => string;
}

function MapCard({ map, onDelete, formatDate }: MapCardProps) {
  const styles = useStyles2(getStyles);
  const activeUsers = useMapActiveUsers(map.uid, true, false, true);

  return (
    <div className={styles.mapCard}>
      <div className={styles.mapCardContent}>
        <h3 className={styles.mapTitle}>{map.title}</h3>
        <div className={styles.mapMeta}>
          <span className={styles.metaItem}>
            <span className="fa fa-clock-o" /> Updated {formatDate(map.updatedAt)}
          </span>
          {activeUsers.length > 0 && (
            <div className={styles.activeUsersMeta}>
              <UsersIndicator users={activeUsers} limit={3} />
            </div>
          )}
        </div>
      </div>
      <div className={styles.mapCardActions}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => (window.location.href = `/explore-maps/${map.uid}`)}
        >
          Open
        </Button>
        <Button
          variant="destructive"
          fill="text"
          size="sm"
          icon="trash-alt"
          onClick={onDelete}
          aria-label="Delete map"
        />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    pageWrapper: css({
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      backgroundColor: theme.colors.background.primary,
      padding: theme.spacing(3),
    }),
    header: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing(3),
    }),
    headerContent: css({
      flex: 1,
    }),
    pageTitle: css({
      fontSize: theme.typography.h2.fontSize,
      fontWeight: theme.typography.h2.fontWeight,
      margin: 0,
      marginBottom: theme.spacing(1),
    }),
    pageDescription: css({
      color: theme.colors.text.secondary,
      margin: 0,
    }),
    controls: css({
      marginBottom: theme.spacing(3),
    }),
    searchInput: css({
      maxWidth: '400px',
    }),
    errorMessage: css({
      padding: theme.spacing(2),
      backgroundColor: theme.colors.error.main,
      color: theme.colors.error.contrastText,
      borderRadius: theme.shape.radius.default,
      marginBottom: theme.spacing(3),
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      '& p': {
        margin: 0,
      },
    }),
    emptyState: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
    }),
    emptyStateContent: css({
      textAlign: 'center',
      maxWidth: '600px',
    }),
    emptyStateTitle: css({
      fontSize: theme.typography.h3.fontSize,
      fontWeight: theme.typography.h3.fontWeight,
      marginBottom: theme.spacing(2),
    }),
    emptyStateText: css({
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(3),
    }),
    mapGrid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: theme.spacing(2),
    }),
    mapCard: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(2),
      backgroundColor: theme.colors.background.secondary,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      // eslint-disable-next-line @grafana/no-unreduced-motion
      transition: 'all 0.2s',
      '&:hover': {
        borderColor: theme.colors.border.strong,
        boxShadow: theme.shadows.z2,
      },
    }),
    mapCardContent: css({
      flex: 1,
    }),
    mapTitle: css({
      fontSize: theme.typography.h4.fontSize,
      fontWeight: theme.typography.h4.fontWeight,
      margin: 0,
      marginBottom: theme.spacing(1),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    mapMeta: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    metaItem: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    activeUsersMeta: css({
      marginTop: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
    }),
    mapCardActions: css({
      display: 'flex',
      gap: theme.spacing(1),
      justifyContent: 'flex-end',
    }),
  };
};
