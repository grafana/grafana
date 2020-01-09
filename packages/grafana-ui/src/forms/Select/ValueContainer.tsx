import React from 'react';
import { cx } from 'emotion';
import { getSelectStyles } from './getSelectStyles';
import { useTheme } from '../../themes/ThemeContext';

export const ValueContainer = (props: any) => {
  const theme = useTheme();
  const styles = getSelectStyles(theme);
  const { children, isMulti } = props;
  return <div className={cx(styles.valueContainer, isMulti && styles.valueContainerMulti)}>{children}</div>;
};
