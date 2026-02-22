// NOTE: copied from /public/app/features/explore/LimitedDataDisclaimer.tsx
// move to grafana-ui for DRY?

import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Tooltip, useStyles2 } from '@grafana/ui';

type Props = {
  toggleShowAllSeries: () => void;
  info: React.ReactNode;
  tooltip: string;
  buttonLabel: React.ReactNode;
};

export function LimitedDataDisclaimer(props: Props) {
  const { toggleShowAllSeries, info, tooltip, buttonLabel } = props;
  const styles = useStyles2(getStyles);

  return (
    <div key="disclaimer" className={styles.disclaimer}>
      <span className={styles.warningMessage}>
        <Icon name="exclamation-triangle" aria-hidden="true" />
        {info}
      </span>

      <Tooltip content={tooltip}>
        <Button variant="secondary" size="sm" onClick={toggleShowAllSeries}>
          {buttonLabel}
        </Button>
      </Tooltip>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  disclaimer: css({
    label: 'series-disclaimer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),

    // eh :/
    position: 'absolute',
    right: 0,
    bottom: 0,
  }),
  warningMessage: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.warning.main,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
