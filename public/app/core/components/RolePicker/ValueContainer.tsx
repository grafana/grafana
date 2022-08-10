import { css, cx } from '@emotion/css';
import React, { forwardRef, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getInputStyles, Icon, IconName, useStyles2, getSelectStyles } from '@grafana/ui';

export interface Props {
  children: ReactNode;
  iconName?: IconName;
}
export const ValueContainer = forwardRef<HTMLDivElement, Props>(({ children, iconName }, ref) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.container} ref={ref}>
      {iconName && <Icon name={iconName} size="xs" />}
      {children}
    </div>
  );
});

ValueContainer.displayName = 'ValueContainer';

const getStyles = (theme: GrafanaTheme2) => {
  const { prefix } = getInputStyles({ theme });
  const { multiValueContainer } = getSelectStyles(theme);
  return {
    container: cx(
      prefix,
      multiValueContainer,
      css`
        position: relative;
        padding: ${theme.spacing(0.5, 1, 0.5, 1)};

        svg {
          margin-right: ${theme.spacing(0.5)};
        }
      `
    ),
  };
};
