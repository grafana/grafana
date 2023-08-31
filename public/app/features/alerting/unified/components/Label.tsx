import { css } from '@emotion/css';
import React, { ReactNode } from 'react';
import tinycolor2 from 'tinycolor2';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, useStyles2 } from '@grafana/ui';

export type LabelSize = 'md' | 'sm';

interface Props {
  icon?: IconName;
  label?: ReactNode;
  value: ReactNode;
  color?: string;
  size?: LabelSize;
}

// TODO allow customization with color prop
const Label = ({ label, value, icon, color, size = 'md' }: Props) => {
  const styles = useStyles2((theme) => getStyles(theme, color, size));

  return (
    <div className={styles.wrapper} role="listitem">
      <Stack direction="row" gap={0} alignItems="stretch" wrap={false}>
        <div className={styles.label}>
          <Stack direction="row" gap={0.5} alignItems="center">
            {icon && <Icon name={icon} />} {label ?? ''}
          </Stack>
        </div>
        <div className={styles.value}>{value}</div>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, color?: string, size?: string) => {
  const backgroundColor = color ?? theme.colors.secondary.main;

  const borderColor = theme.isDark
    ? tinycolor2(backgroundColor).lighten(5).toString()
    : tinycolor2(backgroundColor).darken(5).toString();

  const valueBackgroundColor = theme.isDark
    ? tinycolor2(backgroundColor).darken(5).toString()
    : tinycolor2(backgroundColor).lighten(5).toString();

  const fontColor = color
    ? tinycolor2.mostReadable(backgroundColor, ['#000', '#fff']).toString()
    : theme.colors.text.primary;

  const padding =
    size === 'md' ? `${theme.spacing(0.33)} ${theme.spacing(1)}` : `${theme.spacing(0.2)} ${theme.spacing(0.6)}`;

  return {
    wrapper: css`
      color: ${fontColor};
      font-size: ${theme.typography.bodySmall.fontSize};

      border-radius: ${theme.shape.borderRadius(2)};
    `,
    label: css`
      display: flex;
      align-items: center;
      color: inherit;

      padding: ${padding};
      background: ${backgroundColor};

      border: solid 1px ${borderColor};
      border-top-left-radius: ${theme.shape.borderRadius(2)};
      border-bottom-left-radius: ${theme.shape.borderRadius(2)};
    `,
    value: css`
      color: inherit;
      padding: ${padding};
      background: ${valueBackgroundColor};

      border: solid 1px ${borderColor};
      border-left: none;
      border-top-right-radius: ${theme.shape.borderRadius(2)};
      border-bottom-right-radius: ${theme.shape.borderRadius(2)};
    `,
  };
};

export { Label };
