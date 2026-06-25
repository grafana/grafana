import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { getTagColorsFromName, Icon, useStyles2, useTheme2 } from '@grafana/ui';

export interface Props {
  label: string;
  removeIcon: boolean;
  count: number;
  onClick?: React.MouseEventHandler<SVGElement>;
}

export const TagBadge = ({ count, label, onClick, removeIcon }: Props) => {
  const { isLight } = useTheme2();
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const [darkShade, lightShade] = getTagColorsFromName(label, visualRefreshEnabled);
  let backgroundColor = darkShade;
  let borderColor = lightShade;
  if (visualRefreshEnabled) {
    backgroundColor = isLight ? lightShade : darkShade;
    borderColor = isLight ? darkShade : lightShade;
  }
  const styles = useStyles2(getStyles);

  const countLabel = count !== 0 && <span style={{ marginLeft: '3px' }}>{`(${count})`}</span>;

  return (
    <span
      className={styles.badge}
      style={{
        backgroundColor,
        color: visualRefreshEnabled ? borderColor : undefined,
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
  }),
});
