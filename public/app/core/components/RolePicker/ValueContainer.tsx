import React, { ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { getInputStyles, Icon, IconName, useStyles2, getSelectStyles } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

export interface Props {
  children: ReactNode;
  iconName?: IconName;
}
export const ValueContainer = ({ children, iconName }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.container}>
      {iconName && <Icon name={iconName} size="xs" />}
      {children}
    </div>
  );
};

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
