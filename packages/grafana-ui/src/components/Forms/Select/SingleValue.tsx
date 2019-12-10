import React from 'react';
import { SelectableValue } from '@grafana/data';
import { useTheme } from '../../../themes/ThemeContext';
import { getSelectStyles } from './getSelectStyles';

interface SingleValueProps<T> {
  value: SelectableValue<T>;
  renderValue?: (value: SelectableValue<any>) => JSX.Element;
}

export const SingleValue = React.forwardRef<HTMLDivElement, SingleValueProps<any>>(({ value, renderValue }: any) => {
  const theme = useTheme();
  const styles = getSelectStyles(theme);
  return <div className={styles.singleValue}>{renderValue ? renderValue(value) : value.label}</div>;
});
