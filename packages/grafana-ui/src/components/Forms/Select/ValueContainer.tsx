import React from 'react';
import { useTheme } from '../../../themes/ThemeContext';
import { getSelectStyles } from './getSelectStyles';

export const ValueContainer = (props: any) => {
  const theme = useTheme();
  const styles = getSelectStyles(theme);
  const { children } = props;
  return <div className={styles.valueContainer}>{children}</div>;
};
