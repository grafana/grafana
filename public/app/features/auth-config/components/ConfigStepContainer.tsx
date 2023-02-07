import { css } from '@emotion/css';
import React, { PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

interface Props {
  name: string;
  onSave: () => void;
}

export const ConfigStepContainer = ({ name, onSave, children }: PropsWithChildren<Props>): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <div className={styles.header}>
        <h2>{name}</h2>
        <Button size="sm" fill="outline" onClick={() => onSave()}>
          Save changes
        </Button>
      </div>
      <div className={styles.formContent}>{children}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    formContent: css`
      margin: ${theme.spacing(4)} 0;
    `,
    header: css`
      display: flex;
      justify-content: space-between;
    `,
  };
};
