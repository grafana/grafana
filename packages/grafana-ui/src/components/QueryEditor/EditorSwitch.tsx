import { css } from '@emotion/css';
import React, { ComponentProps } from 'react';

import { Switch } from '../Switch/Switch';

// Wrapper component around <Switch /> that properly aligns it in <EditorField />
export const EditorSwitch: React.FC<ComponentProps<typeof Switch>> = (props) => {
  const styles = getStyles();

  return (
    <div className={styles.switch}>
      <Switch {...props} />
    </div>
  );
};

const getStyles = () => {
  return {
    switch: css({
      display: 'flex',
      alignItems: 'center',
      minHeight: 30,
    }),
  };
};
