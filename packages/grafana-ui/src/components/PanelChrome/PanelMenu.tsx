import { css, cx } from '@emotion/css';
import { type ReactElement, useCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { Dropdown } from '../Dropdown/Dropdown';
import { type TooltipPlacement } from '../Tooltip/types';

interface PanelMenuProps {
  menu: ReactElement | (() => ReactElement);
  menuButtonClass?: string;
  dragClassCancel?: string;
  title?: string;
  placement?: TooltipPlacement;
  offset?: [number, number];
  onOpenMenu?: () => void;
}

export function PanelMenu({
  menu,
  title,
  placement = 'bottom',
  offset,
  dragClassCancel,
  menuButtonClass,
  onOpenMenu,
}: PanelMenuProps) {
  const styles = useStyles2(getStyles);
  const testId = title ? selectors.components.Panels.Panel.menu(title) : `panel-menu-button`;

  const handleVisibility = useCallback(
    (show: boolean) => {
      if (show && onOpenMenu) {
        onOpenMenu();
      }
    },
    [onOpenMenu]
  );

  const overlay = () => {
    const menuContent = typeof menu === 'function' ? menu() : menu;
    return <div className={cx(dragClassCancel, styles.menuContainer)}>{menuContent}</div>;
  };

  return (
    <Dropdown overlay={overlay} placement={placement} offset={offset} onVisibleChange={handleVisibility}>
      <Button
        aria-label={t('grafana-ui.panel-menu.label', 'Menu for panel {{ title }}', { title: title ?? 'Untitled' })}
        title={t('grafana-ui.panel-menu.title', 'Menu')}
        icon="ellipsis-v"
        variant="secondary"
        size="sm"
        data-testid={testId}
        className={cx(menuButtonClass, dragClassCancel)}
      />
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  menuContainer: css({
    '& > [role="menu"]': {
      maxWidth: 'min(260px, calc(100vw - 32px))',
    },
    '& > [role="menu"] > [data-role="menuitem"] > div > span': {
      maxHeight: '1.6em',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'max-height 180ms ease-out',
      },
    },
    '& > [role="menu"] > [data-role="menuitem"]:is(:hover, :focus-visible) > div > span': {
      maxHeight: '10em',
      overflowWrap: 'anywhere',
      textAlign: 'start',
      textOverflow: 'clip',
      whiteSpace: 'normal',
    },
  }),
});
