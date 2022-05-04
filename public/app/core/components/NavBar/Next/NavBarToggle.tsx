import { css } from '@emotion/css';
import classnames from 'classnames';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

export interface Props {
  className?: string;
  isExpanded: boolean;
  onClick: () => void;
}

export const NavBarToggle = ({ className, isExpanded, onClick }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const now = new Date();
  const hour = now.getHours() % 12;
  const minute = now.getMinutes();

  const hourDegree = (hour / 12) * 360;
  const minuteDegree = (minute / 60) * 360;

  return (
    <div
      aria-label={isExpanded ? 'Close navigation menu' : 'Open navigation menu'}
      className={classnames(className, styles.icon)}
      onClick={onClick}
    >
      <div className={styles.hourHand} style={{ transform: `rotate(${hourDegree}deg)` }} />
      <div className={styles.minuteHand} style={{ transform: `rotate(${minuteDegree}deg)` }} />
    </div>
  );
};

NavBarToggle.displayName = 'NavBarToggle';

const getStyles = (theme: GrafanaTheme2) => ({
  hourHand: css({
    width: 2,
    height: 8,
    display: 'inline-block',
    background: '#000000ad',
    position: 'absolute',
    top: 'calc(50% - 8px)',
    left: 'calc(50% - 1px)',
    transformOrigin: 'bottom',
  }),
  minuteHand: css({
    width: 2,
    height: 5,
    display: 'inline-block',
    background: '#000000ad',
    position: 'absolute',
    top: 'calc(50% - 5px)',
    left: 'calc(50% - 1px)',
    transformOrigin: 'bottom',
  }),
  icon: css({
    width: 24,
    height: 24,
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: '50%',
    marginRight: 0,
    zIndex: theme.zIndex.sidemenu + 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',

    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  }),
});
