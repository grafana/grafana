import React, { useContext } from 'react';
import { getModalStyles } from './getModalStyles';
import { ThemeContext } from '../../themes';
import { cx } from 'emotion';

interface Props {
  title: string;
  icon?: string;
}

export const ModalHeader: React.FC<Props> = ({ icon, title, children }) => {
  const theme = useContext(ThemeContext);
  const styles = getModalStyles(theme);

  return (
    <>
      <h2 className={styles.modalHeaderTitle}>
        {icon && <i className={cx(`fa fa-${icon}`, styles.modalHeaderIcon)} />}
        {title}
      </h2>
      {children}
    </>
  );
};
