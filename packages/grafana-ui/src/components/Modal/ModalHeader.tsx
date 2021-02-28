import React, { useContext } from 'react';
import { getModalStyles } from './getModalStyles';
import { IconName } from '../../types';
import { ThemeContext } from '../../themes';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '..';

interface Props {
  title: string;
  icon?: IconName;
  iconTooltip?: string;
}

export const ModalHeader: React.FC<Props> = ({ icon, iconTooltip, title, children }) => {
  const theme = useContext(ThemeContext);
  const styles = getModalStyles(theme);

  return (
    <>
      <h2 className={styles.modalHeaderTitle}>
        {icon && !iconTooltip && <Icon name={icon} size="lg" className={styles.modalHeaderIcon} />}
        {icon && iconTooltip && (
          <Tooltip content={iconTooltip}>
            <Icon name={icon} size="lg" className={styles.modalHeaderIcon} />
          </Tooltip>
        )}
        {title}
      </h2>
      {children}
    </>
  );
};
