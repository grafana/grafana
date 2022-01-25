import React from 'react';

import { useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { getSelectStyles } from './getSelectStyles';

interface MultiValueContainerProps {
  innerProps: any;
}

export const MultiValueContainer: React.FC<MultiValueContainerProps> = ({ innerProps, children }) => {
  const theme = useTheme2();
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
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  return (
    <div {...innerProps} className={styles.multiValueRemove} role="button">
      <Icon name="times" size="sm" />
    </div>
  );
};
