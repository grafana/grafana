import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Menu, Dropdown, useStyles2, useTheme2, ToolbarButton } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { useSelector } from 'app/types';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { findCreateActions } from './utils';

export interface Props {}

export const QuickAdd = ({}: Props) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const navBarTree = useSelector((state) => state.navBarTree);
  const breakpoint = theme.breakpoints.values.sm;

  const [isOpen, setIsOpen] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(!window.matchMedia(`(min-width: ${breakpoint}px)`).matches);
  const createActions = useMemo(() => findCreateActions(navBarTree), [navBarTree]);

  useMediaQueryChange({
    breakpoint,
    onChange: (e) => {
      setIsSmallScreen(!e.matches);
    },
  });

  const MenuActions = () => {
    return (
      <Menu>
        {createActions.map((createAction, index) => (
          <Menu.Item
            key={index}
            url={createAction.url}
            label={createAction.text}
            onClick={() => reportInteraction('grafana_menu_item_clicked', { url: createAction.url, from: 'quickadd' })}
          />
        ))}
      </Menu>
    );
  };

  return createActions.length > 0 ? (
    <>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
        <ToolbarButton
          iconOnly
          icon={isSmallScreen ? 'plus-circle' : 'plus'}
          isOpen={isSmallScreen ? undefined : isOpen}
          aria-label="New"
        />
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
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  }),
});
