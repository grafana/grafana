import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Menu, Dropdown, Button, Icon, useStyles2, useTheme2, ToolbarButton } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { useSelector } from 'app/types';

import { NavToolbarSeparator } from '../NavToolbarSeparator';

import { findCreateActions } from './utils';

export interface Props {}

export const QuickAdd = ({}: Props) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const navBarTree = useSelector((state) => state.navBarTree);
  const breakpoint = theme.breakpoints.values.sm;

  const [isSmallScreen, setIsSmallScreen] = useState(window.matchMedia(`(max-width: ${breakpoint}px)`).matches);
  const createActions = findCreateActions(navBarTree);

  useMediaQueryChange({
    breakpoint,
    onChange: (e) => {
      setIsSmallScreen(e.matches);
    },
  });

  const MenuActions = () => {
    return (
      <Menu>
        {createActions.map((createAction, index) => (
          <Menu.Item key={index} url={createAction.url} label={createAction.text} />
        ))}
      </Menu>
    );
  };

  return createActions.length > 0 ? (
    <>
      <Dropdown overlay={MenuActions} placement="bottom-end">
        {isSmallScreen ? (
          <ToolbarButton iconOnly icon="plus-circle" aria-label="New" />
        ) : (
          <Button variant="primary" size="sm" icon="plus">
            <div className={styles.buttonContent}>
              <span className={styles.buttonText}>New</span>
              <Icon name="angle-down" />
            </div>
          </Button>
        )}
      </Dropdown>
      <NavToolbarSeparator className={styles.separator} />
    </>
  ) : null;
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
  separator: css({
    marginLeft: theme.spacing(1),
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  }),
});
