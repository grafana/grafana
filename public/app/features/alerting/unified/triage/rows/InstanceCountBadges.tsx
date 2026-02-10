import { css } from '@emotion/css';

import { Trans } from '@grafana/i18n';
import { Button, Icon, Text, useStyles2 } from '@grafana/ui';

import { InstanceCounts } from '../types';

interface InstanceCountBadgesProps {
  counts: InstanceCounts;
}

function CountText({ value }: { value: number }) {
  const styles = useStyles2(getStyles);
  return <span className={styles.countText}>{value}</span>;
}

export function InstanceCountBadges({ counts }: InstanceCountBadgesProps) {
  const styles = useStyles2(getStyles);
  const { firing, pending } = counts;

  return (
    <div className={styles.container}>
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
    </div>
  );
}

/**
 * Invisible placeholder that matches the layout width of the OpenDrawerButton (sm outline Button with "Details" text).
 * Used in group rows to align badges with rule rows that have the drawer button.
 */
export function DrawerButtonSpacer() {
  return (
    <Button variant="secondary" fill="outline" size="sm" style={{ visibility: 'hidden' }}>
      <Trans i18nKey="alerting.open-drawer-icon-button.details">Details</Trans>
    </Button>
  );
}

const getStyles = () => ({
  container: css({
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  }),
  slot: css({
    display: 'flex',
    // Reserve space even when empty so badges align across rows.
    minWidth: 42,
    justifyContent: 'flex-end',
  }),
  badge: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
  }),
  countText: css({
    display: 'inline-block',
    minWidth: '1.5em',
    textAlign: 'center',
  }),
});
