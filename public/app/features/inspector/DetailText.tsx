import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => css`
  margin: 0;
  margin-left: ${theme.spacing(2)};
  font-size: ${theme.typography.bodySmall.fontSize};
  color: ${theme.colors.text.secondary};
`;

export const DetailText = ({ children }: React.PropsWithChildren<{}>) => {
  const collapsedTextStyles = useStyles2(getStyles);
  return <p className={collapsedTextStyles}>{children}</p>;
};
