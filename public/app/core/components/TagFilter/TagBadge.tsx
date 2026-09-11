import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { getTagColorsFromName, Icon, useStyles2, useTheme2 } from '@grafana/ui';

export interface Props {
  label: string;
  removeIcon: boolean;
  count: number;
  onClick?: React.MouseEventHandler<SVGElement>;
}

export const TagBadge = ({ count, label, onClick, removeIcon }: Props) => {
  const theme = useTheme2();
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  const styles = useStyles2(getStyles);
  const { background, text } = getTagColorsFromName(label, theme);

  const countLabel = count !== 0 && <span style={{ marginLeft: '3px' }}>{`(${count})`}</span>;

  return (
    <span
      className={styles.badge}
      style={{
        backgroundColor: background,
        color: visualRefreshEnabled ? text : undefined,
      }}
    >
      {removeIcon && <Icon onClick={onClick} name="times" />}
      {label} {countLabel}
    </span>
  );
};

export const getStyles = (theme: GrafanaTheme2, isVisualRefreshEnabled?: boolean) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
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
        gap: theme.spacing(0.5),
        borderRadius: theme.shape.radius.pill,
        padding: `${theme.spacing.x0} ${theme.spacing.x1}`,
        border: 'none',
        height: '20px',
        // needed for the icon/text gap below to take effect
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        fontSize: theme.typography.size.xs,
        fontWeight: theme.typography.fontWeightRegular,
      }
    ),
  };
};
