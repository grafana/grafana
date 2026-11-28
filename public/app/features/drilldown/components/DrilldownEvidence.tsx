import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { type AppKey } from '../mockScenario';

import { FlameGraphPanel } from './evidence/FlameGraphPanel';
import { LogLinesPanel } from './evidence/LogLinesPanel';
import { RequestDurationPanel } from './evidence/RequestDurationPanel';
import { SpanWaterfallPanel } from './evidence/SpanWaterfallPanel';
import { FailedOrdersPanel, SlowQueriesPanel } from './evidence/SqlPanels';

interface Props {
  appUrls: Partial<Record<AppKey, string>>;
  // Controls for the evidence, such as the time range, right-aligned on the first group's header.
  actions?: ReactNode;
}

// Evidence follows the investigation, not the signals: what users feel, where it breaks, and why.
export function DrilldownEvidence({ appUrls, actions }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <section className={styles.section}>
      <Text element="h2" variant="h3">
        {t('drilldown-page.evidence.title', 'Evidence')}
      </Text>
      {/* The heading sits as close to the first group as the other section headings do to their content. */}
      <div className={styles.groups}>
        <EvidenceGroup
          title={t('drilldown-page.evidence.impact-title', 'Impact')}
          finding={t(
            'drilldown-page.evidence.impact-finding',
            'Requests on /pay slowed right after deploy v231, and orders started failing.'
          )}
          columns="1fr 1fr"
          actions={actions}
        >
          <RequestDurationPanel />
          <FailedOrdersPanel />
        </EvidenceGroup>
        <EvidenceGroup
          title={t('drilldown-page.evidence.where-title', 'Where it breaks')}
          finding={t(
            'drilldown-page.evidence.where-finding',
            'payments.charge holds up the checkout request and times out at about 900ms.'
          )}
          columns="3fr 2fr"
        >
          <SpanWaterfallPanel tracesUrl={appUrls.traces} />
          <LogLinesPanel />
        </EvidenceGroup>
        <EvidenceGroup
          title={t('drilldown-page.evidence.why-title', 'Why')}
          finding={t(
            'drilldown-page.evidence.why-finding',
            'Two causes inside payments: extra CPU in encode() and a slow SELECT on payments.'
          )}
          columns="1fr 1fr"
        >
          <FlameGraphPanel />
          <SlowQueriesPanel dbUrl={appUrls.sql} />
        </EvidenceGroup>
      </div>
    </section>
  );
}

interface GroupProps {
  title: string;
  finding: string;
  columns: string;
  actions?: ReactNode;
  children: ReactNode[];
}

function EvidenceGroup({ title, finding, columns, actions, children }: GroupProps) {
  const styles = useStyles2(getStyles, columns);

  return (
    <div className={styles.group}>
      <Stack justifyContent="space-between" alignItems="center" wrap="wrap" gap={1}>
        <Stack gap={1} alignItems="baseline" wrap="wrap">
          <Text element="h3" variant="h5">
            {title}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {finding}
          </Text>
        </Stack>
        {actions}
      </Stack>
      {/* Panels in a group stretch to the same height, so a row never leaves a gap below the shorter one. */}
      <div className={styles.row}>
        {children.map((panel, index) => (
          <div key={index} className={styles.cell}>
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, columns = '1fr 1fr') => ({
  section: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  groups: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  }),
  group: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  row: css({
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: columns,
    alignItems: 'stretch',
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: '1fr',
    },
  }),
  cell: css({
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    '& > *': {
      flex: 1,
    },
  }),
});
