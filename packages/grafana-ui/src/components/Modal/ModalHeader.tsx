import React from 'react';

import { useStyles2 } from '../../themes';
import { IconName } from '../../types';

import { getModalStyles } from './getModalStyles';

interface Props {
  title: string;
  id?: string;
  /** @deprecated */
  icon?: IconName;
  /** @deprecated */
  iconTooltip?: string;
}

/** @internal */
export const ModalHeader = ({ icon, iconTooltip, title, children, id }: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getModalStyles);

  return (
    <>
      <h2 className={styles.modalHeaderTitle} id={id}>
        {title}
      </h2>
      {children}
    </>
  );
};
