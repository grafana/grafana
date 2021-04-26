import React from 'react';
import { getModalStyles } from './getModalStyles';
import { IconName } from '../../types';
import { useStyles2 } from '../../themes';

interface Props {
  title: string;
  /** @deprecated */
  icon?: IconName;
  /** @deprecated */
  iconTooltip?: string;
}

/** @internal */
export const ModalHeader: React.FC<Props> = ({ icon, iconTooltip, title, children }) => {
  const styles = useStyles2(getModalStyles);

  return (
    <>
      <h2 className={styles.modalHeaderTitle}>{title}</h2>
      {children}
    </>
  );
};
