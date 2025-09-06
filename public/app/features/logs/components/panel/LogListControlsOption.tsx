import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

interface LogControlOptionProps {
  label?: string;
  expanded: boolean;
  tooltip: string;
}

export type Props = React.ComponentProps<typeof IconButton> & LogControlOptionProps;

export const LogListControlsOption = React.forwardRef<HTMLButtonElement, Props>(
  (
    { expanded, label, tooltip, className: iconButtonClassName, name: iconButtonName, ...iconButtonProps }: Props,
    ref
  ) => {
    const styles = useStyles2(getStyles, expanded);

    return (
      <div className={styles.container}>
        <label className={styles.label}>
          <span className={styles.labelText}>{label ?? tooltip}</span>
          <span className={styles.iconContainer}>
            <IconButton
              name={iconButtonName}
              tooltip={tooltip}
              className={iconButtonClassName}
              ref={ref}
              {...iconButtonProps}
            />
          </span>
        </label>
      </div>
    );
  }
);

const getStyles = (theme: GrafanaTheme2, expanded: boolean) => {
  return {
    labelText: css({
      display: expanded ? 'block' : 'none',
    }),
    iconContainer: css({
      width: theme.spacing(4),
      display: 'flex',
      alignItems: 'center',
    }),
    container: css({
      fontSize: theme.typography.pxToRem(12),
      height: theme.spacing(2),
    }),
    label: css({
      display: 'flex',
      justifyContent: 'space-between',
    }),
  };
};

LogListControlsOption.displayName = 'LogListControlsOption';
