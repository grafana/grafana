import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { toIconName, useStyles2 } from '@grafana/ui';

import { NavBarMenuItem } from './NavBarMenuItem';
import { NavBarMenuSection } from './NavBarMenuSection';
import { isMatchOrChildMatch } from './utils';

export function NavBarMenuItemWrapper({
  link,
  activeItem,
  onClose,
}: {
  link: NavModelItem;
  activeItem?: NavModelItem;
  onClose: () => void;
}) {
  const styles = useStyles2(getStyles);

  if (link.emptyMessage && !linkHasChildren(link)) {
    return (
      <NavBarMenuSection onClose={onClose} link={link} activeItem={activeItem}>
        <ul className={styles.children}>
          <div className={styles.emptyMessage}>{link.emptyMessage}</div>
        </ul>
      </NavBarMenuSection>
    );
  }

  return (
    <NavBarMenuSection onClose={onClose} link={link} activeItem={activeItem}>
      {linkHasChildren(link) && (
        <ul className={styles.children}>
          {link.children.map((childLink) => {
            const icon = childLink.icon ? toIconName(childLink.icon) : undefined;
            return (
              !childLink.isCreateAction && (
                <NavBarMenuItem
                  key={`${link.text}-${childLink.text}`}
                  isActive={isMatchOrChildMatch(childLink, activeItem)}
                  isChild
                  icon={childLink.showIconInNavbar ? icon : undefined}
                  onClick={() => {
                    childLink.onClick?.();
                    onClose();
                  }}
                  target={childLink.target}
                  url={childLink.url}
                >
                  {childLink.text}
                </NavBarMenuItem>
              )
            );
          })}
        </ul>
      )}
    </NavBarMenuSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  children: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  flex: css({
    display: 'flex',
  }),
  itemWithoutMenu: css({
    position: 'relative',
    placeItems: 'inherit',
    justifyContent: 'start',
    display: 'flex',
    flexGrow: 1,
    alignItems: 'center',
  }),
  fullWidth: css({
    height: '100%',
    width: '100%',
  }),
  iconContainer: css({
    display: 'flex',
    placeContent: 'center',
  }),
  itemWithoutMenuContent: css({
    display: 'grid',
    gridAutoFlow: 'column',
    gridTemplateColumns: `${theme.spacing(7)} auto`,
    alignItems: 'center',
    height: '100%',
  }),
  linkText: css({
    fontSize: theme.typography.pxToRem(14),
    justifySelf: 'start',
  }),
  emptyMessage: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
    padding: theme.spacing(1, 1.5, 1, 7),
  }),
});

function linkHasChildren(link: NavModelItem): link is NavModelItem & { children: NavModelItem[] } {
  return Boolean(link.children && link.children.length > 0);
}
