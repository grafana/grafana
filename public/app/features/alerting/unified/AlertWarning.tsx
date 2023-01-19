import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';

interface AlertWarningProps {
  title: string;
  children: React.ReactNode;
}
export function AlertWarning({ title, children }: AlertWarningProps) {
  return (
    <Alert className={useStyles2(warningStyles).warning} severity="warning" title={title}>
      <p>{children}</p>
      <LinkButton href="alerting/list">To rule list</LinkButton>
    </Alert>
  );
}

const warningStyles = (theme: GrafanaTheme2) => ({
  warning: css`
    margin: ${theme.spacing(4)};
  `,
});
