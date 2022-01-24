import React from 'react';

import { useTheme2 } from '../../themes';
import { IconButton } from '../IconButton/IconButton';
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
    <div {...innerProps} className={styles.multiValueRemove}>
      <IconButton name="times" size="sm" aria-label="select multi clear value" />
    </div>
  );
};
