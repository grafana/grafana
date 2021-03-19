import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

interface Props {
  labelKey: string;
  value: string;
}

export const AlertLabel: FC<Props> = ({ labelKey, value }) => (
  <div className={useStyles(getStyles)}>
    {labelKey}={value}
  </div>
);

export const getStyles = (theme: GrafanaTheme) => css`
  padding: ${theme.spacing.xs};
  border-radius: ${theme.border.radius.sm};
  border: solid 1px #343b40; // @TODO
  font-size: ${theme.typography.size.sm};
  background-color: ${theme.colors.bg2};
  font-weight: ${theme.typography.weight.bold};
  color: ${theme.colors.formLabel};
  display: inline-block;
`;
