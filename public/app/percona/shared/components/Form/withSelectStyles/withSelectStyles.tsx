import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { getStyles } from './withSelectStyles.styles';

export const withSelectStyles = <T extends object>(Component: FC<T>): FC<T> => (props) => {
  const styles = useStyles(getStyles);
  return <Component className={styles.select} {...props} />;
};
