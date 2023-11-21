import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, clearButtonStyles, useStyles2 } from '@grafana/ui';

interface AlertConditionProps {
  warning?: Error;
  error?: Error;
  isCondition?: boolean;
  onSetCondition?: () => void;
}

export const ExpressionStatusIndicator = ({ error, warning, isCondition, onSetCondition }: AlertConditionProps) => {
  const styles = useStyles2(getStyles);

  const elements: JSX.Element[] = [];

  if (error && isCondition) {
    return <Badge color="red" icon="exclamation-circle" text="Alert condition" tooltip={error.message} />;
  } else if (error) {
    elements.push(<Badge key="error" color="red" icon="exclamation-circle" text="Error" tooltip={error.message} />);
  }

  if (warning && isCondition) {
    return <Badge color="orange" icon="exclamation-triangle" text="Alert condition" tooltip={warning.message} />;
  } else if (warning) {
    elements.push(
      <Badge key="warning" color="orange" icon="exclamation-triangle" text="Warning" tooltip={warning.message} />
    );
  }

  if (isCondition) {
    elements.unshift(<Badge key="condition" color="green" icon="check" text="Alert condition" />);
  } else {
    elements.unshift(
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

  return <>{elements}</>;
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
