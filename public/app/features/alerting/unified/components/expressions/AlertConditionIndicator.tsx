import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, useStyles2 } from '@grafana/ui';

interface AlertConditionProps {
  enabled?: boolean;
  error?: Error;
  warning?: Error;
  onSetCondition: () => void;
}

export const AlertConditionIndicator: FC<AlertConditionProps> = ({
  enabled = false,
  error,
  warning,
  onSetCondition,
}) => {
  const styles = useStyles2(getStyles);

  if (enabled && error) {
    return <Badge color="red" icon="exclamation-circle" text="Alert condition" tooltip={error.message} />;
  }

  if (enabled && warning) {
    return <Badge color="orange" icon="exclamation-triangle" text="Alert condition" tooltip={warning.message} />;
  }

  if (enabled && !error && !warning) {
    return <Badge color="green" icon="check" text="Alert condition" />;
  }

  if (!enabled) {
    return (
      <div className={styles.actionLink} onClick={() => onSetCondition()}>
        Make this the alert condition
      </div>
    );
  }

  return null;
};

const getStyles = (theme: GrafanaTheme2) => ({
  actionLink: css`
    color: ${theme.colors.text.link};
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  `,
});
