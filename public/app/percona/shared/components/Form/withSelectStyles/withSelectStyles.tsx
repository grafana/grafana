/* eslint-disable react/display-name */
import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { getStyles } from './withSelectStyles.styles';

export const withSelectStyles =
  <T extends object>(Component: FC<React.PropsWithChildren<T>>): FC<React.PropsWithChildren<T>> =>
  (props) => {
    const styles = useStyles(getStyles);
    return <Component className={styles.select} {...props} />;
  };
