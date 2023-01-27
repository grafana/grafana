import { css } from '@emotion/css';
import React, { PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

interface Props {
  name: string;
  onStepChange: () => void;
}

export const ConfigStepContainer = ({ name, children, onStepChange }: PropsWithChildren<Props>): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <h2>{name}</h2>
      <div className={styles.formContent}>{children}</div>
      <Button onClick={onStepChange}>Next</Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    formContent: css`
      margin: ${theme.spacing(4)} 0;
    `,
  };
};
