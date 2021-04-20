import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

const getStyles = (theme: GrafanaTheme) => css`
  margin: 0;
  margin-left: ${theme.spacing.md};
  font-size: ${theme.typography.size.sm};
  color: ${theme.colors.textWeak};
  overflow: hidden;
  text-overflow: ellipsis;
`;

interface DetailTextProps {
  children: string;
  title?: string;
}

export const DetailText: FC<DetailTextProps> = ({ children, title }) => {
  const collapsedTextStyles = useStyles(getStyles);

  return (
    <p title={title ? title : children} className={collapsedTextStyles}>
      {children}
    </p>
  );
};
