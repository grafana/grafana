import { type PropsWithChildren } from 'react';

import { useStyles2 } from '../../themes/ThemeContext';

import { getModalStyles } from './getModalStyles';

interface Props {
  title: string;
  id?: string;
}

/** @internal */
export const ModalHeader = ({ title, children, id }: PropsWithChildren<Props>) => {
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
