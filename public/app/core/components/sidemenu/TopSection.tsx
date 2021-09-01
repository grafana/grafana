import React, { FC } from 'react';
import { cloneDeep, filter } from 'lodash';
import TopSectionItem from './TopSectionItem';
import config from '../../config';
import { locationService } from '@grafana/runtime';

const TopSection: FC<any> = () => {
  const navTree = cloneDeep(config.bootData.navTree);
  const mainLinks = filter(navTree, (item) => !item.hideFromMenu);
  const searchLink = {
    text: 'Search dashboards',
    icon: 'search',
  };

  const onOpenSearch = () => {
    locationService.partial({ search: 'open' });
  };

  return (
    <div data-testid="top-section-items" className="sidemenu__top">
      <TopSectionItem link={searchLink} onClick={onOpenSearch} />
      {mainLinks.map((link, index) => {
        return <TopSectionItem link={link} key={`${link.id}-${index}`} />;
      })}
    </div>
  );
};

export default TopSection;
