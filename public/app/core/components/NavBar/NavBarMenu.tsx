import React, { useRef } from 'react';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { CustomScrollbar, Icon, IconButton, IconName, useTheme2 } from '@grafana/ui';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { css } from '@emotion/css';
import { NavBarMenuItem } from './NavBarMenuItem';

export interface Props {
  activeItem?: NavModelItem;
  navItems: NavModelItem[];
  onClose: () => void;
}

export function NavBarMenu({ activeItem, navItems, onClose }: Props) {
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
                  <NavBarMenuItem
                    isActive={activeItem === link}
                    isSectionHeader
                    onClick={() => {
                      link.onClick?.();
                      onClose();
                    }}
                    target={link.target}
                    text={link.text}
                    url={link.url}
                  />
                  {link.children?.map((childLink) => (
                    <NavBarMenuItem
                      key={childLink.id}
                      icon={childLink.icon as IconName}
                      isActive={activeItem === childLink}
                      isDivider={childLink.divider}
                      onClick={() => {
                        childLink.onClick?.();
                        onClose();
                      }}
                      target={childLink.target}
                      text={childLink.text}
                      url={childLink.url}
                    />
                  ))}
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
