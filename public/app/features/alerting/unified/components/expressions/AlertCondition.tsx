import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, useStyles2 } from '@grafana/ui';

interface AlertConditionProps {
  enabled?: boolean;
  onSetCondition: () => void;
}

export const AlertCondition: FC<AlertConditionProps> = ({ enabled = false, onSetCondition }) => {
  const styles = useStyles2(getStyles);

  return enabled ? (
    <Badge color="green" icon="check" text="Alert condition" />
  ) : (
    <div className={styles.actionLink} onClick={() => onSetCondition()}>
      Make this the alert condition
    </div>
  );
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
