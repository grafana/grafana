import React from 'react';

import { useTheme2 } from '../../themes';
import { IconButton, Props as IconButtonProps } from '../IconButton/IconButton';

import { getSelectStyles } from './getSelectStyles';

interface MultiValueContainerProps {
  innerProps: JSX.IntrinsicElements['div'];
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
  innerProps: IconButtonProps;
};

export const MultiValueRemove: React.FC<MultiValueRemoveProps> = ({ children, innerProps }) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  return <IconButton {...innerProps} name="times" size="sm" className={styles.multiValueRemove} />;
};
