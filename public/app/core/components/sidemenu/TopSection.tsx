import React from 'react';
import { cloneDeep } from 'lodash';
import { locationService } from '@grafana/runtime';
import { Icon, IconName } from '@grafana/ui';
import SideMenuItem from './SideMenuItem';
import config from '../../config';
import { NavModelItem } from '@grafana/data';

const TopSection = () => {
  const navTree: NavModelItem[] = cloneDeep(config.bootData.navTree);
  const mainLinks = navTree.filter((item) => !item.hideFromMenu);

  const onOpenSearch = () => {
    locationService.partial({ search: 'open' });
  };

  return (
    <div data-testid="top-section-items" className="sidemenu__top">
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
