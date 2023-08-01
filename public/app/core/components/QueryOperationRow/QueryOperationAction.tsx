import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { IconButton, IconName, useStyles2 } from '@grafana/ui';

interface BaseQueryOperationActionProps {
  icon: IconName;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

function BaseQueryOperationAction(props: QueryOperationActionProps | QueryOperationToggleActionProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.icon, 'active' in props && props.active && styles.active)}>
      <IconButton
        name={props.icon}
        tooltip={props.title}
        className={styles.icon}
        disabled={!!props.disabled}
        onClick={props.onClick}
        type="button"
        aria-label={selectors.components.QueryEditorRow.actionButton(props.title)}
        {...('active' in props && { 'aria-pressed': props.active })}
      />
    </div>
  );
}

interface QueryOperationActionProps extends BaseQueryOperationActionProps {}
export function QueryOperationAction(props: QueryOperationActionProps) {
  return <BaseQueryOperationAction {...props} />;
}

interface QueryOperationToggleActionProps extends BaseQueryOperationActionProps {
  active: boolean;
}
export const QueryOperationToggleAction = (props: QueryOperationToggleActionProps) => {
  return <BaseQueryOperationAction {...props} />;
};

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
        border-radius: ${theme.shape.radius.default};
        bottom: -8px;
        background-image: ${theme.colors.gradients.brandHorizontal} !important;
      }
    `,
  };
};
