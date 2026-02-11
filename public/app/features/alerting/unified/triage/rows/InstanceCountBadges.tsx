import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Text, useStyles2 } from '@grafana/ui';

import { InstanceCounts } from '../types';

interface RowActionsProps {
  counts: InstanceCounts;
  actionButton?: ReactNode;
}

export function RowActions({ counts, actionButton }: RowActionsProps) {
  const styles = useStyles2(getStyles);
  const { firing, pending } = counts;

  return (
    <div className={styles.grid}>
      <div className={styles.slot}>
        {pending > 0 && (
          <Text color="warning">
            <span className={styles.badge}>
              <Icon name="circle" size="sm" />
              <CountText value={pending} />
            </span>
          </Text>
        )}
      </div>
      <div className={styles.slot}>
        {firing > 0 && (
          <Text color="error">
            <span className={styles.badge}>
              <Icon name="exclamation-circle" size="sm" />
              <CountText value={firing} />
            </span>
          </Text>
        )}
      </div>
      <div className={styles.slot}>{actionButton}</div>
    </div>
  );
}

function CountText({ value }: { value: number }) {
  const styles = useStyles2(getStyles);
  return <span className={styles.countText}>{value}</span>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 2fr',
    alignItems: 'center',
  }),
  slot: css({
    display: 'flex',
    justifyContent: 'flex-end',
  }),
  badge: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
  }),
  countText: css({
    display: 'inline-block',
    minWidth: '1.5em',
    textAlign: 'center',
  }),
});
