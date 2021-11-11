import React from 'react';
import { css } from '@emotion/css';
import { stylesFactory, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

interface InputGroupProps {}

const InputGroup: React.FC<InputGroupProps> = ({ children }) => {
  const theme = useTheme2();
  const styles = useStyles(theme);

  return <div className={styles.root}>{children}</div>;
};

const useStyles = stylesFactory((theme: GrafanaTheme2) => ({
  root: css({
    display: 'flex',

    // Style the direct children of the component
    '> *': {
      '&:not(:first-child)': {
        // Negative margin hides the double-border on adjacent selects
        marginLeft: -1,
      },

      '&:first-child': {
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
      },

      '&:last-child': {
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
      },

      '&:not(:first-child):not(:last-child)': {
        borderRadius: 0,
      },

      position: 'relative',
      zIndex: 1,

      '&:hover': {
        zIndex: 2,
      },
      '&:focus-within': {
        zIndex: 2,
      },
    },
  }),
}));

export default InputGroup;
