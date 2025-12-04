import { css, cx } from '@emotion/css';
import { useState, useMemo, useCallback, Fragment, useEffect, forwardRef, useImperativeHandle } from 'react';

import { DataQuery, dateTime, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  Avatar,
  Badge,
  Box,
  Checkbox,
  Divider,
  EmptyState,
  Field,
  Icon,
  Input,
  ScrollContainer,
  Stack,
  TagsInput,
  Text,
  useStyles2,
} from '@grafana/ui';

export interface QueryLibraryViewRef {
  selectCurrentQuery: () => void;
  saveQuery: () => void;
  canSave: () => boolean;
}

// Stub saved queries for demonstration
const STUB_SAVED_QUERIES: Array<{
  uid: string;
  title: string;
  description: string;
  queryText: string;
  datasourceName: string;
  datasourceType: string;
  datasourceUid: string;
  user: { uid: string; displayName: string; avatarUrl?: string };
  createdAtTimestamp: number;
  tags: string[];
  isVisible: boolean;
  query: DataQuery;
}> = [
  {
    uid: '1',
    title: 'Rate then sum by(label) then avg',
    description: 'Returns CPU usage metrics for all hosts',
    queryText: 'rate(node_cpu_seconds_total{mode="user"}[5m])',
    datasourceName: 'Prometheus',
    datasourceType: 'prometheus',
    datasourceUid: 'prometheus',
    user: { uid: 'admin', displayName: 'Admin' },
    createdAtTimestamp: Date.now() - 86400000,
    tags: ['metrics', 'cpu'],
    isVisible: true,
    query: {
      refId: 'A',
      datasource: { type: 'prometheus', uid: 'prometheus' },
    },
  },
  {
    uid: '2',
    title: 'History quantile on rate',
    description: 'Returns memory usage metrics',
    queryText: 'node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100',
    datasourceName: 'Loki',
    datasourceType: 'loki',
    datasourceUid: 'loki',
    user: { uid: 'admin', displayName: 'Admin' },
    createdAtTimestamp: Date.now() - 172800000,
    tags: ['metrics', 'memory'],
    isVisible: true,
    query: {
      refId: 'A',
      datasource: { type: 'loki', uid: 'loki' },
    },
  },
  {
    uid: '3',
    title: 'Binary Query',
    description: 'Returns network traffic in/out bytes',
    queryText: 'rate(node_network_receive_bytes_total[5m])',
    datasourceName: 'InfluxDB',
    datasourceType: 'influxdb',
    datasourceUid: 'influxdb',
    user: { uid: 'editor', displayName: 'Editor' },
    createdAtTimestamp: Date.now() - 259200000,
    tags: ['network'],
    isVisible: false,
    query: {
      refId: 'A',
      datasource: { type: 'influxdb', uid: 'influxdb' },
    },
  },
  {
    uid: '4',
    title: 'Service Latency',
    description: 'Returns service latency metrics',
    queryText: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
    datasourceName: 'Tempo',
    datasourceType: 'tempo',
    datasourceUid: 'tempo',
    user: { uid: 'admin', displayName: 'Admin' },
    createdAtTimestamp: Date.now() - 345600000,
    tags: ['latency', 'service'],
    isVisible: true,
    query: {
      refId: 'A',
      datasource: { type: 'tempo', uid: 'tempo' },
    },
  },
  {
    uid: '5',
    title: 'Network Throughput',
    description: 'Returns network throughput metrics',
    queryText: 'rate(node_network_transmit_bytes_total[5m])',
    datasourceName: 'Graphite',
    datasourceType: 'graphite',
    datasourceUid: 'graphite',
    user: { uid: 'admin', displayName: 'Admin' },
    createdAtTimestamp: Date.now() - 432000000,
    tags: ['network', 'throughput'],
    isVisible: true,
    query: {
      refId: 'A',
      datasource: { type: 'graphite', uid: 'graphite' },
    },
  },
  {
    uid: '6',
    title: 'Log Volume',
    description: 'Returns log volume metrics',
    queryText: 'sum(rate({job="varlogs"}[5m]))',
    datasourceName: 'Loki',
    datasourceType: 'loki',
    datasourceUid: 'loki',
    user: { uid: 'admin', displayName: 'Admin' },
    createdAtTimestamp: Date.now() - 518400000,
    tags: ['logs', 'volume'],
    isVisible: true,
    query: {
      refId: 'A',
      datasource: { type: 'loki', uid: 'loki' },
    },
  },
];

export interface QueryLibraryViewProps {
  mode: 'browse' | 'save';
  currentQuery?: DataQuery;
  onSelectQuery?: (query: DataQuery) => void;
  onSaveQuery?: (name: string, description: string) => void;
  onClose: () => void;
}

// Component to render datasource icon
function DatasourceIcon({ datasourceType, className }: { datasourceType: string; className?: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const ds = await getDataSourceSrv().get({ type: datasourceType });
        if (ds?.meta?.info?.logos?.small) {
          setLogoUrl(ds.meta.info.logos.small);
        }
      } catch {
        // Datasource not found, will use fallback
      }
    };
    fetchLogo();
  }, [datasourceType]);

  if (logoUrl) {
    return <img src={logoUrl} alt={datasourceType} className={className} />;
  }

  // Fallback to generic icon
  return <Icon name="database" />;
}

export const QueryLibraryView = forwardRef<QueryLibraryViewRef, QueryLibraryViewProps>(function QueryLibraryView(
  { mode, currentQuery, onSelectQuery, onSaveQuery, onClose },
  ref
) {
  const styles = useStyles2(getStyles);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Selection state
  const [selectedQueryIndex, setSelectedQueryIndex] = useState(0);

  // Form state for new/edit query
  const [formTitle, setFormTitle] = useState(
    mode === 'save' ? t('explore.query-library.default-title', 'New query') : ''
  );
  const [formDescription, setFormDescription] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formIsVisible, setFormIsVisible] = useState(true);

  // Filter queries
  const filteredQueries = useMemo(() => {
    return STUB_SAVED_QUERIES.filter((q) => {
      const matchesSearch =
        !searchQuery ||
        q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.queryText.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [searchQuery]);

  // Current selected query or new query
  const selectedQuery = mode === 'save' ? null : filteredQueries[selectedQueryIndex];

  const handleSelectQuery = useCallback(
    (query: DataQuery) => {
      onSelectQuery?.(query);
    },
    [onSelectQuery]
  );

  const handleSaveQuery = useCallback(() => {
    if (formTitle.trim()) {
      onSaveQuery?.(formTitle, formDescription);
    }
  }, [formTitle, formDescription, onSaveQuery]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      selectCurrentQuery: () => {
        if (selectedQuery) {
          handleSelectQuery(selectedQuery.query);
        }
      },
      saveQuery: () => {
        handleSaveQuery();
      },
      canSave: () => {
        return formTitle.trim().length > 0;
      },
    }),
    [selectedQuery, handleSelectQuery, handleSaveQuery, formTitle]
  );

  const isFiltered = Boolean(searchQuery);
  const isEmpty = filteredQueries.length === 0 && mode === 'browse';

  // Get current datasource type for icons
  const getCurrentDatasourceType = () => {
    if (currentQuery?.datasource && typeof currentQuery.datasource === 'object' && 'type' in currentQuery.datasource) {
      return currentQuery.datasource.type || '';
    }
    return '';
  };

  // Render query list item
  const renderQueryItem = (query: (typeof STUB_SAVED_QUERIES)[0], index: number) => (
    <Fragment key={query.uid}>
      <label className={cx(styles.queryItem, mode === 'browse' && selectedQueryIndex === index && styles.selected)}>
        <input
          type="radio"
          name="query-library-list"
          className={styles.radioInput}
          checked={mode === 'browse' && selectedQueryIndex === index}
          onChange={() => setSelectedQueryIndex(index)}
          disabled={mode === 'save'}
        />
        <Stack alignItems="center" gap={1} minWidth={0}>
          <DatasourceIcon datasourceType={query.datasourceType} className={styles.datasourceIcon} />
          <Text truncate>{query.title}</Text>
        </Stack>
      </label>
      <Divider spacing={0} />
    </Fragment>
  );

  // Render details form
  const renderDetailsForm = () => {
    const query = mode === 'save' ? null : selectedQuery;
    const queryText = mode === 'save' ? JSON.stringify(currentQuery, null, 2) : query?.queryText;
    const getDatasourceName = () => {
      if (mode !== 'save') {
        return query?.datasourceName || '';
      }
      if (
        currentQuery?.datasource &&
        typeof currentQuery.datasource === 'object' &&
        'type' in currentQuery.datasource
      ) {
        return currentQuery.datasource.type || 'Unknown';
      }
      return 'Unknown';
    };
    const datasourceName = getDatasourceName();
    const datasourceType = mode === 'save' ? getCurrentDatasourceType() : query?.datasourceType || '';
    const author = mode === 'save' ? { displayName: 'Current User' } : query?.user;
    const dateAdded = mode === 'save' ? new Date() : query ? new Date(query.createdAtTimestamp) : new Date();
    const formattedDate = dateTime(dateAdded).format('ddd MMM DD YYYY HH:mm [GMT]ZZ');

    return (
      <Stack direction="column" flex={1} height="100%">
        <Box flex={1}>
          {/* Title with icon */}
          <Box marginBottom={2}>
            <Stack gap={1} alignItems="center">
              <DatasourceIcon datasourceType={datasourceType} className={styles.datasourceIconLarge} />
              <Box flex={1}>
                <Input
                  id="query-title"
                  value={mode === 'save' ? formTitle : query?.title || ''}
                  onChange={(e) => mode === 'save' && setFormTitle(e.currentTarget.value)}
                  readOnly={mode !== 'save'}
                />
              </Box>
            </Stack>
          </Box>

          {/* Query text */}
          <Box marginBottom={2}>
            <code className={styles.queryCode}>{queryText}</code>
          </Box>

          <Stack direction="column" gap={2}>
            {/* Data source */}
            <Field label={t('query-library.query-details.datasource', 'Datasource')} noMargin>
              <Input readOnly value={datasourceName} />
            </Field>

            {/* Author */}
            <Field label={t('query-library.query-details.author', 'Author')} noMargin>
              <Input
                readOnly
                prefix={
                  <Box marginRight={0.5}>
                    <Avatar width={2} height={2} src="https://secure.gravatar.com/avatar" alt="" />
                  </Box>
                }
                value={author?.displayName || ''}
              />
            </Field>

            {/* Description */}
            <Field label={t('query-library.query-details.description', 'Description')} noMargin>
              <Input
                value={mode === 'save' ? formDescription : query?.description || ''}
                onChange={(e) => mode === 'save' && setFormDescription(e.currentTarget.value)}
                readOnly={mode !== 'save'}
              />
            </Field>

            {/* Tags */}
            <Field label={t('query-library.query-details.tags', 'Tags')} noMargin>
              <TagsInput
                tags={mode === 'save' ? formTags : query?.tags || []}
                onChange={(tags) => mode === 'save' && setFormTags(tags)}
                disabled={mode !== 'save'}
              />
            </Field>

            {/* Date added */}
            <Field label={t('query-library.query-details.date-added', 'Date added')} noMargin>
              <Input readOnly value={formattedDate} />
            </Field>

            {/* Share checkbox */}
            <Field noMargin>
              <Checkbox
                label={t('query-library.query-details.make-query-visible', 'Share query with all users')}
                checked={mode === 'save' ? formIsVisible : query?.isVisible || false}
                onChange={(e) => mode === 'save' && setFormIsVisible(e.currentTarget.checked)}
                disabled={mode !== 'save'}
              />
            </Field>
          </Stack>
        </Box>
      </Stack>
    );
  };

  return (
    <Stack height="100%" direction="column" gap={0}>
      {/* Content - two column layout */}
      {isEmpty ? (
        <EmptyState
          variant={isFiltered ? 'not-found' : 'call-to-action'}
          message={
            isFiltered
              ? t('query-library.not-found.title', 'No results found')
              : t('query-library.empty-state.title', "You haven't saved any queries yet")
          }
        >
          {isFiltered ? (
            <Trans i18nKey="query-library.not-found.message">Try adjusting your search or filter criteria</Trans>
          ) : (
            <Trans i18nKey="query-library.empty-state.message">
              Start adding them from Explore or when editing a dashboard
            </Trans>
          )}
        </EmptyState>
      ) : (
        <Stack flex={1} gap={0} minHeight={0}>
          {/* Left column - Query list with search */}
          <Box display="flex" flex={1} minWidth={0} direction="column">
            {/* Search field */}
            <Box padding={2}>
              <Input
                prefix={<Icon name="search" />}
                placeholder={t('query-library.filters.search', 'Search by...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
              />
            </Box>

            <ScrollContainer>
              <Stack direction="column" gap={0} flex={1} minWidth={0}>
                {/* New query item when in save mode */}
                {mode === 'save' && currentQuery && (
                  <>
                    <label className={cx(styles.queryItem, styles.selected)}>
                      <input type="radio" name="query-library-list" className={styles.radioInput} checked readOnly />
                      <Stack alignItems="center" justifyContent="space-between" width="100%">
                        <Stack alignItems="center" gap={1} minWidth={0}>
                          <DatasourceIcon
                            datasourceType={getCurrentDatasourceType()}
                            className={styles.datasourceIcon}
                          />
                          <Text truncate>{formTitle || t('explore.query-library.default-title', 'New query')}</Text>
                        </Stack>
                        <Badge text={t('query-library.item.new', 'New')} color="orange" />
                      </Stack>
                    </label>
                    <Divider spacing={0} />
                  </>
                )}

                {/* Existing queries */}
                {filteredQueries.map((query, index) => renderQueryItem(query, index))}
              </Stack>
            </ScrollContainer>
          </Box>

          <Divider direction="vertical" spacing={0} />

          {/* Right column - Details form */}
          <Box display="flex" flex={2} minWidth={0}>
            <ScrollContainer>
              <Box
                direction="column"
                display="flex"
                flex={1}
                paddingBottom={2}
                paddingLeft={2}
                paddingRight={2}
                paddingTop={2}
              >
                {renderDetailsForm()}
              </Box>
            </ScrollContainer>
          </Box>
        </Stack>
      )}
    </Stack>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  queryItem: css({
    display: 'block',
    width: '100%',
    padding: theme.spacing(2),
    position: 'relative',
    cursor: 'pointer',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create(['background-color'], {
        duration: theme.transitions.duration.short,
      }),
    },
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  selected: css({
    backgroundColor: theme.colors.action.selected,
    '&:hover': {
      backgroundColor: theme.colors.action.selected,
    },
  }),
  radioInput: css({
    position: 'absolute',
    opacity: 0,
    cursor: 'pointer',
  }),
  datasourceIcon: css({
    width: '16px',
    height: '16px',
    objectFit: 'contain',
  }),
  datasourceIconLarge: css({
    width: '24px',
    height: '24px',
    objectFit: 'contain',
  }),
  queryCode: css({
    backgroundColor: theme.colors.action.disabledBackground,
    borderRadius: theme.shape.radius.default,
    display: 'block',
    margin: theme.spacing(0, 0, 2, 0),
    overflowWrap: 'break-word',
    padding: theme.spacing(1),
    whiteSpace: 'pre-wrap',
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
