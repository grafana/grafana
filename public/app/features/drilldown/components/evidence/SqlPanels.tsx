import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type Column, InteractiveTable, LinkButton, PanelChrome, useStyles2 } from '@grafana/ui';

import { FAILED_ORDERS, SLOW_QUERIES } from '../../mockScenario';

type FailedOrder = (typeof FAILED_ORDERS)[number];
type SlowQuery = (typeof SLOW_QUERIES)[number];

export function FailedOrdersPanel() {
  const styles = useStyles2(getStyles);

  const columns: Array<Column<FailedOrder>> = [
    {
      id: 'orderId',
      header: t('drilldown-page.evidence.order-id', 'order_id'),
      cell: ({ value }) => <span className={styles.code}>{value}</span>,
    },
    { id: 'amount', header: t('drilldown-page.evidence.amount', 'amount'), disableGrow: true },
    { id: 'status', header: t('drilldown-page.evidence.status', 'status'), disableGrow: true },
    { id: 'time', header: t('drilldown-page.evidence.time', 'time'), disableGrow: true },
  ];

  return (
    <PanelChrome title={t('drilldown-page.evidence.failed-orders', 'Failed orders (orders table)')}>
      <InteractiveTable
        className={styles.table}
        columns={columns}
        data={FAILED_ORDERS}
        getRowId={(row) => row.orderId}
      />
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
      header: t('drilldown-page.evidence.query', 'query'),
      cell: ({ value }) => <span className={styles.code}>{value}</span>,
    },
    { id: 'p95', header: t('drilldown-page.evidence.p95', 'p95'), disableGrow: true },
  ];

  return (
    <PanelChrome
      title={t('drilldown-page.evidence.slow-queries', 'Slowest queries, checkout DB')}
      actions={
        dbUrl && (
          <LinkButton href={dbUrl} size="sm" variant="secondary">
            {t('drilldown-page.evidence.open-db', 'Open in DB O11y')}
          </LinkButton>
        )
      }
    >
      <InteractiveTable className={styles.table} columns={columns} data={SLOW_QUERIES} getRowId={(row) => row.query} />
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
