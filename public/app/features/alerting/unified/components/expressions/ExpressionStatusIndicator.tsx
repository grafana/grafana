import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, clearButtonStyles, useStyles2 } from '@grafana/ui';

interface AlertConditionProps {
  isCondition?: boolean;
  onSetCondition?: () => void;
}

export const ExpressionStatusIndicator = ({ isCondition, onSetCondition }: AlertConditionProps) => {
  const styles = useStyles2(getStyles);

  if (isCondition) {
    return <Badge key="condition" color="green" icon="check" text="Alert condition" />;
  } else {
    return (
      <button
        key="make-condition"
        type="button"
        className={styles.actionLink}
        onClick={() => onSetCondition && onSetCondition()}
      >
        Set as alert condition
      </button>
    );
  }
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
