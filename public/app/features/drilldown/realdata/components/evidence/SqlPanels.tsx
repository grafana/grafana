import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type Column, InteractiveTable, LinkButton, PanelChrome, useStyles2 } from '@grafana/ui';

import { FAILED_ORDERS, SLOW_QUERIES } from '../../liveScenario';

type FailedOrder = (typeof FAILED_ORDERS)[number];
type SlowQuery = (typeof SLOW_QUERIES)[number];

export function FailedOrdersPanel() {
  const styles = useStyles2(getStyles);

  const columns: Array<Column<FailedOrder>> = [
    {
      id: 'orderId',
      header: t('drilldown-real.evidence.order-id', 'order_id'),
      cell: ({ value }) => <span className={styles.code}>{value}</span>,
    },
    { id: 'amount', header: t('drilldown-real.evidence.amount', 'amount'), disableGrow: true },
    { id: 'status', header: t('drilldown-real.evidence.status', 'status'), disableGrow: true },
    { id: 'time', header: t('drilldown-real.evidence.time', 'time'), disableGrow: true },
  ];

  return (
    <PanelChrome title={t('drilldown-real.evidence.failed-orders', 'Failed orders')}>
      {FAILED_ORDERS.length === 0 ? (
        <span>{t('drilldown-real.evidence.no-sql', 'No SQL data source connected.')}</span>
      ) : (
        <InteractiveTable
          className={styles.table}
          columns={columns}
          data={FAILED_ORDERS}
          getRowId={(row) => row.orderId}
        />
      )}
    </PanelChrome>
  );
}

interface SlowQueriesPanelProps {
  dbUrl?: string;
}

export function SlowQueriesPanel({ dbUrl }: SlowQueriesPanelProps) {
  const styles = useStyles2(getStyles);

  const columns: Array<Column<SlowQuery>> = [
    {
      id: 'query',
      header: t('drilldown-real.evidence.query', 'query'),
      cell: ({ value }) => <span className={styles.code}>{value}</span>,
    },
    { id: 'p95', header: t('drilldown-real.evidence.p95', 'p95'), disableGrow: true },
  ];

  return (
    <PanelChrome
      title={t('drilldown-real.evidence.slow-queries', 'Slowest queries')}
      actions={
        dbUrl && (
          <LinkButton href={dbUrl} size="sm" variant="secondary">
            {t('drilldown-real.evidence.open-db', 'Open in DB O11y')}
          </LinkButton>
        )
      }
    >
      {SLOW_QUERIES.length === 0 ? (
        <span>{t('drilldown-real.evidence.no-sql-queries', 'No SQL data source connected.')}</span>
      ) : (
        <InteractiveTable
          className={styles.table}
          columns={columns}
          data={SLOW_QUERIES}
          getRowId={(row) => row.query}
        />
      )}
    </PanelChrome>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  code: css({
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  // Denser rows than InteractiveTable's default, to fit the panel as a compact evidence summary.
  table: css({
    'th, td': {
      padding: theme.spacing(0.25, 1),
      whiteSpace: 'nowrap',
    },
    th: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightRegular,
    },
    'tr, th': {
      borderBottom: 'none',
    },
  }),
});
