import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getTagColorsFromName, Icon, useStyles2 } from '@grafana/ui';

export interface Props {
  label: string;
  removeIcon: boolean;
  count: number;
  onClick?: React.MouseEventHandler<SVGElement>;
}

export const TagBadge = ({ count, label, onClick, removeIcon }: Props) => {
  const { color } = getTagColorsFromName(label);
  const styles = useStyles2(getStyles);

  const countLabel = count !== 0 && <span style={{ marginLeft: '3px' }}>{`(${count})`}</span>;

  return (
    <span
      className={styles.badge}
      style={{
        backgroundColor: color,
      }}
    >
      {removeIcon && <Icon onClick={onClick} name="times" />}
      {label} {countLabel}
    </span>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  badge: css({
    ...theme.typography.bodySmall,
    backgroundColor: theme.v1.palette.gray1,
    borderRadius: theme.shape.radius.default,
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
  }),
});
