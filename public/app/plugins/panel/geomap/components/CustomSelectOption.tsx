import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';

type Props = {
  value: string;
};

export const CustomSelectOption = ({ value }: Props) => {
  const measureStyle = getStyles(config.theme);

  return <span className={`${measureStyle.customSelectOption}`}>{value}</span>;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  customSelectOption: css`
    font-size: 11px;
  `,
}));
