import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

interface Props {
  labelKey: string;
  value: string;
  operator?: string;
  onRemoveLabel?: () => void;
}

export const AlertLabel = ({ labelKey, value, operator = '=', onRemoveLabel }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {labelKey}
      {operator}
      {value}
      {!!onRemoveLabel && <IconButton name="times" size="xs" onClick={onRemoveLabel} />}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    padding: ${theme.spacing(0.5, 1)};
    border-radius: ${theme.shape.borderRadius(1)};
    border: solid 1px ${theme.colors.border.medium};
    font-size: ${theme.typography.bodySmall.fontSize};
    background-color: ${theme.colors.background.secondary};
    font-weight: ${theme.typography.fontWeightBold};
    color: ${theme.colors.text.primary};
    display: inline-block;
    line-height: 1.2;
  `,
});
