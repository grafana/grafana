import React from 'react';

import { useStyles2 } from '../../themes';

import { getModalStyles } from './getModalStyles';

interface Props {
  title: string;
  id?: string;
}

/** @internal */
export const ModalHeader: React.FC<Props> = ({ title, children, id }) => {
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
