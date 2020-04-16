import React, { FC } from 'react';
import { css } from 'emotion';
import { stylesFactory } from '@grafana/ui';

interface Props {
  step: { heading: string; subheading: string; title: string; info: string; cards: any[] };
}

export const Step: FC<Props> = ({ step }) => {
  const styles = getStyles();

  return (
    <div className={styles.setup}>
      <div className={styles.info}>
        <h2>{step.title}</h2>
        <p>{step.info}</p>
      </div>
    </div>
  );
};

const getStyles = stylesFactory(() => {
  return {
    setup: css`
      margin-bottom: 16px;
    `,
    info: css`
      width: 170px;
    `,
  };
});
