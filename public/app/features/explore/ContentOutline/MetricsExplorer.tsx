import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FilterInput, ScrollContainer, useStyles2 } from '@grafana/ui';

// Static stub list of Prometheus metric names. This is intentionally not fetched
// from a datasource - it only exists to render the Metrics Explorer UI.
const STUB_METRICS = [
  'http_server_requests_seconds_bucket',
  'http_server_requests_seconds_count',
  'http_server_requests_seconds_sum',
  'node_cpu_seconds_total',
  'node_memory_MemAvailable_bytes',
  'node_memory_MemTotal_bytes',
  'process_resident_memory_bytes',
  'process_cpu_seconds_total',
  'grpc_server_handled_total',
  'grpc_server_handling_seconds_bucket',
  'go_goroutines',
  'go_gc_duration_seconds',
  'go_memstats_heap_inuse_bytes',
  'up',
  'prometheus_tsdb_head_series',
  'kube_pod_container_status_running',
  'container_memory_usage_bytes',
  'alertmanager_notifications_total',
];

export function MetricsExplorer() {
  const styles = useStyles2(getStyles);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMetrics = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return STUB_METRICS;
    }
    return STUB_METRICS.filter((metric) => metric.toLowerCase().includes(term));
  }, [searchTerm]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>{t('explore.metrics-explorer.title-metrics', 'Metrics')}</div>
      <FilterInput
        value={searchTerm}
        onChange={setSearchTerm}
        escapeRegex={false}
        placeholder={t('explore.metrics-explorer.search-placeholder', 'Search metrics')}
      />
      <ScrollContainer>
        <ul className={styles.list}>
          {filteredMetrics.map((metric) => (
            <li key={metric} className={styles.listItem} title={metric}>
              {metric}
            </li>
          ))}
        </ul>
      </ScrollContainer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'metrics-explorer',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      minHeight: 0,
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 1, 1, 1),
    }),
    title: css({
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    }),
    list: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
    }),
    listItem: css({
      display: 'block',
      padding: theme.spacing(0.5, 0.5),
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: theme.colors.background.secondary,
        color: theme.colors.text.primary,
      },
    }),
  };
};
