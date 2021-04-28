import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

interface Props {
  labelKey: string;
  value: string;
  isRegex?: boolean;
}

export const AlertLabel: FC<Props> = ({ labelKey, value, isRegex = false }) => (
  <div className={useStyles(getStyles)}>
    {labelKey}={isRegex && '~'}
    {value}
  </div>
);

export const getStyles = (theme: GrafanaTheme) => css`
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-radius: ${theme.border.radius.sm};
  border: solid 1px ${theme.colors.border2};
  font-size: ${theme.typography.size.sm};
  background-color: ${theme.colors.bg2};
  font-weight: ${theme.typography.weight.bold};
  color: ${theme.colors.formLabel};
  display: inline-block;
  line-height: 1.2;
`;
