import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Menu, Dropdown, useStyles2, ToolbarButton } from '@grafana/ui';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { useSelector } from 'app/types';

import { t } from '../../../internationalization';
import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { findCreateActions } from './utils';

export interface Props {}

export const QuickAdd = ({}: Props) => {
  const styles = useStyles2(getStyles);
  const navBarTree = useSelector((state) => state.navBarTree);
  const [isOpen, setIsOpen] = useState(false);

  const createActions = useMemo(() => findCreateActions(navBarTree), [navBarTree]);
  const isSmallScreen = !useMediaQueryMinWidth('sm');
  const showQuickAdd = createActions.length > 0 && !isSmallScreen;

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

  return showQuickAdd ? (
    <>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
        <ToolbarButton
          iconOnly
          icon={isSmallScreen ? 'plus-circle' : 'plus'}
          isOpen={isSmallScreen ? undefined : isOpen}
          aria-label={t('navigation.quick-add.aria-label', 'New')}
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
