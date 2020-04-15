import React from 'react';
import { useTheme } from '../../themes';
import { getSelectStyles } from './getSelectStyles';
import { Icon } from '../Icon/Icon';

interface MultiValueContainerProps {
  innerProps: any;
}

export const MultiValueContainer: React.FC<MultiValueContainerProps> = ({ innerProps, children }) => {
  const theme = useTheme();
  const styles = getSelectStyles(theme);

  return (
    <div {...innerProps} className={styles.multiValueContainer}>
      {children}
    </div>
  );
};

export type MultiValueRemoveProps = {
  innerProps: any;
};

export const MultiValueRemove: React.FC<MultiValueRemoveProps> = ({ children, innerProps }) => {
  const theme = useTheme();
  const styles = getSelectStyles(theme);
  return (
    <div {...innerProps} className={styles.multiValueRemove}>
      <Icon name="times" size="sm" />
    </div>
  );
};
