import { css } from '@emotion/css';
import classnames from 'classnames';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useTheme2 } from '@grafana/ui';

export interface Props {
  className?: string;
  isExpanded: boolean;
  onClick: () => void;
}

export const NavBarToggle = ({ className, isExpanded, onClick }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <IconButton
      aria-label={isExpanded ? 'Close navigation menu' : 'Open navigation menu'}
      name={isExpanded ? 'angle-left' : 'angle-right'}
      className={classnames(className, styles.icon)}
      size="xl"
      onClick={onClick}
    />
  );
};

NavBarToggle.displayName = 'NavBarToggle';

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css({
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: '50%',
    marginRight: 0,
    zIndex: theme.zIndex.sidemenu + 1,

    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  }),
});
