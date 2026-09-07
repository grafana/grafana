import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { getTagColorsFromName, Icon, useTheme2 } from '@grafana/ui';

export interface Props {
  label: string;
  removeIcon: boolean;
  count: number;
  onClick?: React.MouseEventHandler<SVGElement>;
}

export const TagBadge = ({ count, label, onClick, removeIcon }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme, label);

  const countLabel = count !== 0 && <span style={{ marginLeft: '3px' }}>{`(${count})`}</span>;

  return (
    <span className={styles.badge}>
      {removeIcon && <Icon onClick={onClick} name="times" />}
      {label} {countLabel}
    </span>
  );
};

export const getStyles = (theme: GrafanaTheme2, label?: string) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  const { background, text } = getTagColorsFromName(label, theme);
  return {
    badge: css(
      {
        ...theme.typography.bodySmall,
        backgroundColor: theme.v1.palette.gray1,
        borderRadius: theme.shape.radius.sm,
        color: theme.v1.palette.white,
        display: 'inline-block',
        height: '20px',
        lineHeight: '20px',
        padding: theme.spacing(0, 0.75),
        verticalAlign: 'baseline',
        whiteSpace: 'nowrap',
        '&:hover': {
          opacity: 0.85,
        },
      },
      visualRefreshEnabled && {
        backgroundColor: background,
        color: text,
        gap: '3px',
        borderRadius: theme.shape.radius.pill,
        padding: `${theme.spacing.x0} ${theme.spacing.x1}`,
        border: 'none',
        // needed for the icon/text gap below to take effect
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: theme.typography.size.xs,
        fontWeight: theme.typography.fontWeightRegular,
      }
    ),
  };
};
