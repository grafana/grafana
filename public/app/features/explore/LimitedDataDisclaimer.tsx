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
  }),
  warningMessage: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.warning.main,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
