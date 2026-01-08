import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2, QueryResultMetaNotice } from '@grafana/data';
import { Icon, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import { getFocusStyles, getMouseFocusStyles } from '@grafana/ui/internal';

interface Props {
  notice: QueryResultMetaNotice;
  onClick: (e: React.SyntheticEvent, tab: string) => void;
}

export const PanelHeaderNotice = ({ notice, onClick }: Props) => {
  const styles = useStyles2(getStyles);

  const iconName =
    notice.severity === 'error' || notice.severity === 'warning' ? 'exclamation-triangle' : 'file-landscape-alt';

  if (notice.inspect && onClick) {
    return (
      <ToolbarButton
        className={styles.notice}
        icon={iconName}
        iconSize="md"
        key={notice.severity}
        tooltip={notice.text}
        onClick={(e) => onClick(e, notice.inspect!)}
      />
    );
  }

  if (notice.link) {
    return (
      <a className={styles.notice} aria-label={notice.text} href={notice.link} target="_blank" rel="noreferrer">
        <Icon name={iconName} style={{ marginRight: '8px' }} size="md" />
      </a>
    );
  }

  return (
    <Tooltip key={notice.severity} content={notice.text}>
      <span className={styles.iconTooltip}>
        <Icon name={iconName} size="md" />
      </span>
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  notice: css({
    background: 'inherit',
    border: 'none',
    borderRadius: theme.shape.radius.default,
  }),
  iconTooltip: css({
    color: `${theme.colors.text.secondary}`,
    backgroundColor: 'inherit',
    cursor: 'auto',
    border: 'none',
    borderRadius: `${theme.shape.radius.default}`,
    padding: `${theme.spacing(0, 1)}`,
    height: ` ${theme.spacing(theme.components.height.md)}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',

    '&:focus, &:focus-visible': {
      ...getFocusStyles(theme),
      zIndex: 1,
    },
    '&: focus:not(:focus-visible)': getMouseFocusStyles(theme),

    '&:hover ': {
      boxShadow: `${theme.shadows.z1}`,
      color: `${theme.colors.text.primary}`,
      background: `${theme.colors.background.secondary}`,
    },
  }),
});
