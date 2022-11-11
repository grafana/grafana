import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Menu, Dropdown, Button, Icon, useStyles2, useTheme2, ToolbarButton } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';

export interface Props {
  folderId?: number;
  canCreateFolders?: boolean;
  canCreateDashboards?: boolean;
}

export const QuickAdd = ({}: Props) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const breakpoint = theme.breakpoints.values.sm;

  const [isSmallScreen, setIsSmallScreen] = useState(window.matchMedia(`(max-width: ${breakpoint}px)`).matches);

  useMediaQueryChange({
    breakpoint,
    onChange: (e) => {
      setIsSmallScreen(e.matches);
    },
  });

  const MenuActions = () => {
    return (
      <Menu>
        <Menu.Item url="dashboard/new" label="Dashboard" />
        <Menu.Item url="alerting/new" label="Alert rule" />
      </Menu>
    );
  };

  return (
    <Dropdown overlay={MenuActions} placement="bottom-end">
      {isSmallScreen ? (
        <ToolbarButton iconOnly icon="plus-circle" aria-label="New" />
      ) : (
        <Button variant="secondary" size="sm" icon="plus">
          <div className={styles.buttonContent}>
            <span className={styles.buttonText}>New</span>
            <Icon name="angle-down" />
          </div>
        </Button>
      )}
    </Dropdown>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  buttonContent: css({
    alignItems: 'center',
    display: 'flex',
  }),
  buttonText: css({
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  }),
});
