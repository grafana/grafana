import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { IconButton, IconName, useStyles2 } from '@grafana/ui';

interface BaseQueryOperationActionProps {
  icon: IconName;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  dataTestId?: string;
  isGroupEnd?: boolean;
  isHighlighted?: boolean;
}

function BaseQueryOperationAction(props: QueryOperationActionProps | QueryOperationToggleActionProps) {
  const styles = useStyles2(getStyles, Boolean(props.isHighlighted));

  return (
    <div
      className={cx(
        styles.icon,
        'active' in props && props.active && styles.active,
        props.isGroupEnd && styles.iconGroupEnd
      )}
    >
      <IconButton
        name={props.icon}
        tooltip={props.title}
        className={styles.icon}
        disabled={!!props.disabled}
        onClick={props.onClick}
        type="button"
        data-testid={props.dataTestId ?? selectors.components.QueryEditorRow.actionButton(props.title)}
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

const getStyles = (theme: GrafanaTheme2, isHighlighted: boolean) => {
  return {
    icon: css({
      display: 'flex',
      position: 'relative',
      color: isHighlighted ? theme.colors.primary.main : theme.colors.text.secondary,
    }),

    iconGroupEnd: css({
      borderRight: `1px solid ${theme.colors.border.medium}`,
      paddingRight: theme.spacing(0.5),
    }),
    active: css({
      '&:before': {
        display: 'block',
        content: '" "',
        position: 'absolute',
        left: -1,
        right: 2,
        height: 3,
        borderRadius: theme.shape.radius.default,
        bottom: -8,
        backgroundImage: theme.colors.gradients.brandHorizontal,
      },
    }),
  };
};
