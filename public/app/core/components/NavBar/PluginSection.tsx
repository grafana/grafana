import React from 'react';
import { useLocation } from 'react-router-dom';
import { cloneDeep } from 'lodash';
import { css } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Icon, IconName, useTheme2 } from '@grafana/ui';
import config from '../../config';
import { isLinkActive, isSearchActive } from './utils';
import NavBarItem from './NavBarItem';

const TopSection = () => {
  const location = useLocation();
  const theme = useTheme2();
  const styles = getStyles(theme);
  const navTree: NavModelItem[] = cloneDeep(config.bootData.navTree);
  const pluginLinks = navTree.filter((item) => !item.hideFromMenu && item.id?.startsWith('plugin-page-'));
  const activeItemId = pluginLinks.find((item) => isLinkActive(location.pathname, item))?.id;

  return (
    <div data-testid="plugin-section-items" className={styles.container}>
      {pluginLinks.map((link, index) => {
        return (
          <NavBarItem
            key={`${link.id}-${index}`}
            isActive={!isSearchActive(location) && activeItemId === link.id}
            label={link.text}
            menuItems={link.children}
            target={link.target}
            url={link.url}
          >
            {link.icon && <Icon name={link.icon as IconName} size="xl" />}
            {link.img && <img src={link.img} alt={`${link.text} logo`} />}
          </NavBarItem>
        );
      })}
    </div>
  );
};

export default TopSection;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: none;

    ${theme.breakpoints.up('md')} {
      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.components.panel.borderColor};
      border-radius: 2px;
      display: flex;
      flex-direction: inherit;
    }

    .sidemenu-open--xs & {
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
    }
  `,
});
