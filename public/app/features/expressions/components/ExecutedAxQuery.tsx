import { css } from '@emotion/css';
import React from 'react';

export const ExecutedAxQuery: React.FC<any> = () => {
  return (
    <div className={styles.container}>
      Query
    </div>
  );
};

const styles = {
  container: css({
    margin: '1em 0',
  }),
};
