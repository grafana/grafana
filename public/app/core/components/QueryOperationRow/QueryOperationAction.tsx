import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { IconButton, IconName, useStyles2 } from '@grafana/ui';

export interface QueryOperationActionProps {
  icon: IconName;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
}

export const QueryOperationAction: React.FC<QueryOperationActionProps> = ({
  icon,
  active,
  disabled,
  title,
  onClick,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.icon, active && styles.active)}>
      <IconButton
        name={icon}
        tooltip={title}
        className={styles.icon}
        disabled={!!disabled}
        onClick={onClick}
        type="button"
        aria-label={selectors.components.QueryEditorRow.actionButton(title)}
      />
    </div>
  );
};

QueryOperationAction.displayName = 'QueryOperationAction';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css`
      display: flex;
      position: relative;
      color: ${theme.colors.text.secondary};
    `,
    active: css`
      &::before {
        display: block;
        content: ' ';
        position: absolute;
        left: -1px;
        right: 2px;
        height: 3px;
        border-radius: 2px;
        bottom: -8px;
        background-image: ${theme.colors.gradients.brandHorizontal} !important;
      }
    `,
  };
};
