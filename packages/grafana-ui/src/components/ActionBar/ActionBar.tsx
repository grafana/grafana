import React from 'react';
import { css } from 'emotion';
import { stylesFactory } from '../../themes/stylesFactory';

const getActionBarStyles = stylesFactory(() => {
  return {
    container: css`
      margin-bottom: 28px;
      display: -webkit-box;
      display: -webkit-flex;
      display: -ms-flexbox;
      display: flex;
      -webkit-box-align: start;
      -webkit-align-items: flex-start;
      -ms-flex-align: start;
      align-items: flex-start;

      & > a,
      & > button {
        margin-left: 14px;
      }
    `,
    spacing: css`
      width: 28px;
      -webkit-box-flex: 1;
      -webkit-flex-grow: 1;
      -ms-flex-positive: 1;
      flex-grow: 1;
    `,
  };
});

export const ActionBar: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const styles = getActionBarStyles();
  return <div className={styles.container}>{children}</div>;
};

export const ActionBarSpacing: React.FC<{}> = () => {
  const styles = getActionBarStyles();
  return <div className={styles.spacing} />;
};
