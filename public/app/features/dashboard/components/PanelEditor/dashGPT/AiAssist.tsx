import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Button, useStyles2 } from '@grafana/ui';

interface Props {
  text: string;
  onClick: () => void;
}

export const AiAssist = ({ text, onClick }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Button icon="grafana" onClick={onClick} fill="text" size="sm" className={styles.button}>
      {text}
    </Button>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css`
    width: 17px;
    height: 17px;
    margin-right: 4px;
  `,
  button: css`
    '&:hover': {
      background: transparent; // @TODO: remove button background on hover
    },
  `,
});
