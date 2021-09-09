import React from 'react';
import { cloneDeep } from 'lodash';
import { css } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Icon, IconName, styleMixins, useTheme2 } from '@grafana/ui';
import config from '../../config';
import SideMenuItem from './SideMenuItem';

const TopSection = () => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const navTree: NavModelItem[] = cloneDeep(config.bootData.navTree);
  const mainLinks = navTree.filter((item) => !item.hideFromMenu);

  const onOpenSearch = () => {
    locationService.partial({ search: 'open' });
  };

  return (
    <div data-testid="top-section-items" className={styles.container}>
      <SideMenuItem label="Search dashboards" onClick={onOpenSearch}>
        <Icon name="search" size="xl" />
      </SideMenuItem>
      {mainLinks.map((link, index) => {
        return (
          <SideMenuItem
            key={`${link.id}-${index}`}
            label={link.text}
            menuItems={link.children}
            target={link.target}
            url={link.url}
          >
            {link.icon && <Icon name={link.icon as IconName} size="xl" />}
            {link.img && <img src={link.img} alt={`${link.text} logo`} />}
          </SideMenuItem>
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

    @media ${styleMixins.mediaUp(`${theme.breakpoints.values.md}px`)} {
      display: block;
      margin-top: ${theme.spacing(5)};
    }

    .sidemenu-open--xs & {
      display: block;
    }
  `,
});
