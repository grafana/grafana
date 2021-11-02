import React, { useRef } from 'react';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { CustomScrollbar, Icon, IconButton, IconName, useTheme2 } from '@grafana/ui';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { css } from '@emotion/css';
import { NavBarMenuItem } from './NavBarMenuItem';

export interface Props {
  activeItemId?: string;
  navItems: NavModelItem[];
  onClose: () => void;
}

export function NavBarMenu({ activeItemId, navItems, onClose }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const ref = useRef(null);
  const { overlayProps } = useOverlay(
    {
      isDismissable: true,
      isOpen: true,
      onClose,
    },
    ref
  );

  return (
    <FocusScope contain restoreFocus autoFocus>
      <div className={styles.container} ref={ref} {...overlayProps}>
        <div className={styles.header}>
          <Icon name="bars" size="xl" />
          <IconButton aria-label="Close navigation menu" name="times" onClick={onClose} size="xl" variant="secondary" />
        </div>
        <nav className={styles.content}>
          <CustomScrollbar>
            <ul>
              {navItems.map((link) => (
                <div className={styles.section} key={link.id}>
                  <li className={styles.item}>
                    <NavBarMenuItem
                      isActive={activeItemId === link.id}
                      isSectionHeader
                      label={link.text}
                      onClick={() => {
                        link.onClick?.();
                        onClose();
                      }}
                      target={link.target}
                      url={link.url}
                    />
                  </li>
                  {link.children?.map((childLink) => {
                    return !childLink.divider ? (
                      <li className={styles.item} key={childLink.id}>
                        <NavBarMenuItem
                          icon={childLink.icon as IconName}
                          isActive={activeItemId === childLink.id}
                          label={childLink.text}
                          onClick={() => {
                            childLink.onClick?.();
                            onClose();
                          }}
                          target={childLink.target}
                          url={childLink.url}
                        />
                      </li>
                    ) : null;
                  })}
                </div>
              ))}
            </ul>
          </CustomScrollbar>
        </nav>
      </div>
    </FocusScope>
  );
}

NavBarMenu.displayName = 'NavBarMenu';

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    background-color: ${theme.colors.background.canvas};
    bottom: 0;
    display: flex;
    flex-direction: column;
    left: 0;
    min-width: 300px;
    position: fixed;
    right: 0;
    top: 0;

    ${theme.breakpoints.up('md')} {
      border-right: 1px solid ${theme.colors.border.weak};
      right: unset;
    }
  `,
  content: css`
    display: flex;
    flex-direction: column;
    overflow: auto;
  `,
  header: css`
    border-bottom: 1px solid ${theme.colors.border.weak};
    display: flex;
    justify-content: space-between;
    padding: ${theme.spacing(2)};
  `,
  item: css`
    display: flex;
  `,
  section: css`
    border-bottom: 1px solid ${theme.colors.border.weak};
  `,
});
