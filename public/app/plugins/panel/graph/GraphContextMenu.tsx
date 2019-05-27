import React, { useContext, useRef } from 'react';
import { List, Portal, ThemeContext, GrafanaTheme, selectThemeVariant } from '@grafana/ui';
import { css, cx } from 'emotion';
import useClickAway from 'react-use/lib/useClickAway';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick: (event?: React.SyntheticEvent<HTMLElement>) => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items?: ContextMenuItem[];
}

const getContextMenuStyles = (theme: GrafanaTheme) => {
  const linkColor = selectThemeVariant(
    {
      light: theme.colors.dark2,
      dark: theme.colors.text,
    },
    theme.type
  );
  const linkColorHover = selectThemeVariant(
    {
      light: theme.colors.link,
      dark: theme.colors.white,
    },
    theme.type
  );
  return {
    icon: css`
      opacity: 0.7;
      width: 14px;
      height: 14px;
      display: inline-block;
      margin-right: 10px;
      color: ${theme.colors.linkDisabled};
      position: relative;
      top: 3px;
    `,
    link: css`
      color: ${linkColor};
      display: flex;
      padding: 5px 10px;
      border-left: 2px solid transparent;
      cursor: pointer;
      &:hover {
        color: ${linkColorHover};
        text-decoration: none;
        color: $dropdownLinkColorHover;
        background-color: $dropdownLinkBackgroundHover;
      }
    `,
  };
};

// TODO: Move to grafana/ui
const ContextMenu: React.FC<ContextMenuProps> = React.memo(({ x, y, onClose, items }) => {
  const theme = useContext(ThemeContext);
  const menuRef = useRef(null);
  useClickAway(menuRef, () => {
    if (onClose) {
      onClose();
    }
  });

  const styles = getContextMenuStyles(theme);

  return (
    <Portal>
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          left: x - 5,
          top: y + 5,
        }}
        className="dropdown-menu--menu"
      >
        <List
          items={items || []}
          renderItem={item => {
            return (
              <div
                className={styles.link}
                onClick={e => {
                  item.onClick(e);
                  onClose();
                }}
              >
                {item.icon && <i className={cx(`${item.icon}`, styles.icon)} />} {item.label}
              </div>
            );
          }}
        />
      </div>
    </Portal>
  );
});

ContextMenu.displayName = 'ContextMenu';
export const GraphContextMenu = ContextMenu;
