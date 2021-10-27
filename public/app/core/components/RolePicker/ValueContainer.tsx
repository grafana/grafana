import React, { ReactNode } from 'react';
import { getInputStyles, Icon, IconName, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { cx } from '@emotion/css';

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
    container: cx(prefix, multiValueContainer),
  };
};
