import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Icon, toIconName, useTheme2 } from '@grafana/ui';

import { Branding } from '../../Branding/Branding';

interface NavBarItemIconProps {
  link: NavModelItem;
}

export function NavBarItemIcon({ link }: NavBarItemIconProps) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  if (link.icon === 'grafana') {
    return <Branding.MenuLogo className={styles.img} />;
  } else if (link.icon) {
    const iconName = toIconName(link.icon);
    return <Icon name={iconName ?? 'link'} size="xl" />;
  } else {
    // consumer of NavBarItemIcon gives enclosing element an appropriate label
    return <img className={cx(styles.img, link.roundIcon && styles.round)} src={link.img} alt="" />;
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    img: css({
      height: theme.spacing(3),
      width: theme.spacing(3),
    }),
    round: css({
      borderRadius: theme.shape.radius.circle,
    }),
  };
}
