import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { Messages } from './Connected.messages';
import { getStyles } from './Connected.styles';

export const Connected: FC = () => {
  const styles = useStyles(getStyles);

  return (
    <section data-testid="connected-wrapper" className={styles.wrapper}>
      <header className={styles.title}>{Messages.title}</header>
      <p>{Messages.connected}</p>
    </section>
  );
};
