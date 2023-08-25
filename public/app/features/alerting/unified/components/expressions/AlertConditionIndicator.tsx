import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, clearButtonStyles, useStyles2 } from '@grafana/ui';

interface AlertConditionProps {
  enabled?: boolean;
  error?: Error;
  warning?: Error;
  onSetCondition?: () => void;
}

export const AlertConditionIndicator = ({ enabled = false, error, warning, onSetCondition }: AlertConditionProps) => {
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
      <button type="button" className={styles.actionLink} onClick={() => onSetCondition && onSetCondition()}>
        Set as alert condition
      </button>
    );
  }

  return null;
};

const getStyles = (theme: GrafanaTheme2) => {
  const clearButton = clearButtonStyles(theme);

  return {
    actionLink: css`
      ${clearButton};
      color: ${theme.colors.text.link};
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    `,
  };
};
