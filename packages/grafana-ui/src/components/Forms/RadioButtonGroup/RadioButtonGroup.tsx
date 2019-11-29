import React from 'react';
import { css } from 'emotion';

const getRadioButtonGroupStyles = () => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      position: relative;
    `,
  };
};

export const RadioButtonGroup: React.FC = ({ children }) => {
  const styles = getRadioButtonGroupStyles();
  return <div className={styles.wrapper}>{children}</div>;
};
