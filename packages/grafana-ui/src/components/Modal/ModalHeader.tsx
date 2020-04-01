import React, { useContext } from 'react';
import { getModalStyles } from './getModalStyles';
import { IconName } from '../../types';
import { ThemeContext } from '../../themes';
import { Icon } from '../Icon/Icon';

interface Props {
  title: string;
  icon?: IconName;
}

export const ModalHeader: React.FC<Props> = ({ icon, title, children }) => {
  const theme = useContext(ThemeContext);
  const styles = getModalStyles(theme);

  return (
    <>
      <h2 className={styles.modalHeaderTitle}>
        {icon && <Icon name={icon} size="lg" className={styles.modalHeaderIcon} />}
        {title}
      </h2>
      {children}
    </>
  );
};
