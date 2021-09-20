import React from 'react';
import { useLocation } from 'react-router-dom';
import { cloneDeep } from 'lodash';
import { css } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Icon, IconName, useTheme2 } from '@grafana/ui';
import config from '../../config';
import { isLinkActive, isSearchActive } from './utils';
import NavBarItem from './NavBarItem';

const TopSection = () => {
  const location = useLocation();
  const theme = useTheme2();
  const styles = getStyles(theme);
  const navTree: NavModelItem[] = cloneDeep(config.bootData.navTree);
  const mainLinks = navTree.filter((item) => !item.hideFromMenu);
  const activeItemId = mainLinks.find((item) => isLinkActive(location.pathname, item))?.id;

  const onOpenSearch = () => {
    locationService.partial({ search: 'open' });
  };

  return (
    <div data-testid="top-section-items" className={styles.container}>
      <NavBarItem isActive={isSearchActive(location)} label="Search dashboards" onClick={onOpenSearch}>
        <Icon name="search" size="xl" />
      </NavBarItem>
      {mainLinks.map((link, index) => {
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
    flex-grow: 1;

    ${theme.breakpoints.up('md')} {
      display: block;
      margin-top: ${theme.spacing(5)};
    }

    .sidemenu-open--xs & {
      display: block;
    }
  `,
});
