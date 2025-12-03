import { css } from '@emotion/css';
import { useState } from 'react';

import { DataQuery, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Drawer, Icon, Input, Stack, useStyles2 } from '@grafana/ui';

interface SavedQueriesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuery: (query: DataQuery) => void;
  currentQuery?: DataQuery;
}

// Stub saved queries for demonstration
const STUB_SAVED_QUERIES: Array<{ id: string; name: string; description: string; query: DataQuery }> = [
  {
    id: '1',
    name: 'CPU Usage Query',
    description: 'Returns CPU usage metrics for all hosts',
    query: {
      refId: 'A',
      datasource: { type: 'prometheus', uid: 'prometheus' },
    },
  },
  {
    id: '2',
    name: 'Memory Usage Query',
    description: 'Returns memory usage metrics',
    query: {
      refId: 'A',
      datasource: { type: 'prometheus', uid: 'prometheus' },
    },
  },
  {
    id: '3',
    name: 'Network Traffic Query',
    description: 'Returns network traffic in/out bytes',
    query: {
      refId: 'A',
      datasource: { type: 'prometheus', uid: 'prometheus' },
    },
  },
  {
    id: '4',
    name: 'Disk I/O Query',
    description: 'Returns disk read/write operations',
    query: {
      refId: 'A',
      datasource: { type: 'prometheus', uid: 'prometheus' },
    },
  },
];

export function SavedQueriesDrawer({ isOpen, onClose, onSelectQuery, currentQuery }: SavedQueriesDrawerProps) {
  const styles = useStyles2(getStyles);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaveMode, setIsSaveMode] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  const filteredQueries = STUB_SAVED_QUERIES.filter(
    (q) =>
      q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectQuery = (query: DataQuery) => {
    onSelectQuery(query);
    onClose();
  };

  const handleSaveQuery = () => {
    // Stub: In real implementation, this would save to the query library
    // eslint-disable-next-line no-console
    console.log('Saving query:', { name: saveName, description: saveDescription, query: currentQuery });
    alert(t('dashboard-scene.saved-queries-drawer.save-success', 'Query saved successfully! (stub)'));
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Drawer
      title={
        isSaveMode
          ? t('dashboard-scene.saved-queries-drawer.save-title', 'Save Query')
          : t('dashboard-scene.saved-queries-drawer.title', 'Saved Queries')
      }
      onClose={onClose}
      size="md"
    >
      <div className={styles.container}>
        {/* Tab-like buttons to switch modes */}
        <Stack gap={1} direction="row">
          <Button
            variant={!isSaveMode ? 'primary' : 'secondary'}
            fill={!isSaveMode ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setIsSaveMode(false)}
          >
            <Trans i18nKey="dashboard-scene.saved-queries-drawer.browse-tab">Browse</Trans>
          </Button>
          <Button
            variant={isSaveMode ? 'primary' : 'secondary'}
            fill={isSaveMode ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setIsSaveMode(true)}
          >
            <Trans i18nKey="dashboard-scene.saved-queries-drawer.save-tab">Save Current</Trans>
          </Button>
        </Stack>

        {isSaveMode ? (
          /* Save Mode */
          <div className={styles.saveForm}>
            <Stack direction="column" gap={2}>
              <div>
                <label htmlFor="saved-query-name" className={styles.label}>
                  <Trans i18nKey="dashboard-scene.saved-queries-drawer.name-label">Name</Trans>
                </label>
                <Input
                  id="saved-query-name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.currentTarget.value)}
                  placeholder={t('dashboard-scene.saved-queries-drawer.name-placeholder', 'Enter query name...')}
                />
              </div>
              <div>
                <label htmlFor="saved-query-description" className={styles.label}>
                  <Trans i18nKey="dashboard-scene.saved-queries-drawer.description-label">Description</Trans>
                </label>
                <Input
                  id="saved-query-description"
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.currentTarget.value)}
                  placeholder={t(
                    'dashboard-scene.saved-queries-drawer.description-placeholder',
                    'Enter description...'
                  )}
                />
              </div>
              <div className={styles.queryPreview}>
                <span className={styles.label}>
                  <Trans i18nKey="dashboard-scene.saved-queries-drawer.query-preview">Query Preview</Trans>
                </span>
                <pre className={styles.queryCode}>{JSON.stringify(currentQuery, null, 2)}</pre>
              </div>
              <Button onClick={handleSaveQuery} disabled={!saveName.trim()}>
                <Trans i18nKey="dashboard-scene.saved-queries-drawer.save-button">Save Query</Trans>
              </Button>
            </Stack>
          </div>
        ) : (
          /* Browse Mode */
          <>
            <div className={styles.search}>
              <Input
                prefix={<Icon name="search" />}
                placeholder={t('dashboard-scene.saved-queries-drawer.search-placeholder', 'Search saved queries...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
              />
            </div>

            <div className={styles.queryList}>
              {filteredQueries.length === 0 ? (
                <div className={styles.emptyState}>
                  <Trans i18nKey="dashboard-scene.saved-queries-drawer.no-results">No queries found</Trans>
                </div>
              ) : (
                filteredQueries.map((savedQuery) => (
                  <div key={savedQuery.id} className={styles.queryItem}>
                    <div className={styles.queryInfo}>
                      <div className={styles.queryName}>{savedQuery.name}</div>
                      <div className={styles.queryDescription}>{savedQuery.description}</div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSelectQuery(savedQuery.query)}
                      icon="arrow-right"
                    >
                      <Trans i18nKey="dashboard-scene.saved-queries-drawer.use-query">Use</Trans>
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className={styles.stubNotice}>
              <Icon name="info-circle" />
              <span>
                <Trans i18nKey="dashboard-scene.saved-queries-drawer.stub-notice">
                  This is a stub implementation. Enable the queryLibrary feature toggle for full functionality.
                </Trans>
              </span>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    height: '100%',
  }),
  search: css({
    marginTop: theme.spacing(1),
  }),
  queryList: css({
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  queryItem: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    '&:hover': {
      background: theme.colors.action.hover,
      borderColor: theme.colors.border.medium,
    },
  }),
  queryInfo: css({
    flex: 1,
    minWidth: 0,
  }),
  queryName: css({
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing(0.5),
  }),
  queryDescription: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  emptyState: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    color: theme.colors.text.secondary,
  }),
  stubNotice: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    background: theme.colors.info.transparent,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.info.text,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  saveForm: css({
    marginTop: theme.spacing(2),
  }),
  label: css({
    display: 'block',
    marginBottom: theme.spacing(0.5),
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  queryPreview: css({
    marginTop: theme.spacing(1),
  }),
  queryCode: css({
    background: theme.colors.background.secondary,
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
    overflow: 'auto',
    maxHeight: '200px',
  }),
});
