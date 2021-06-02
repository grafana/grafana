import React, { FC, useEffect, useState } from 'react';
import _ from 'lodash';
import TopSectionItem from './TopSectionItem';
import config from '../../config';
import { getLocationSrv, getBackendSrv } from '@grafana/runtime';
import { NavModelItem } from '@grafana/data';
import { buildIntegratedAlertingMenuItem } from './TopSection.utils';

const TopSection: FC<any> = () => {
  const [showDBaaS, setShowDBaaS] = useState(false);
  const navTree = _.cloneDeep(config.bootData.navTree) as NavModelItem[];
  const [mainLinks, setMainLinks] = useState(_.filter(navTree, item => !item.hideFromMenu));
  const searchLink = {
    text: 'Search',
    icon: 'search',
  };
  const dbaasLink = {
    id: 'dbaas',
    icon: 'database',
    text: 'DBaaS',
    url: '/graph/d/pmm-dbaas/pmm-dbaas',
  };
  const onOpenSearch = () => {
    getLocationSrv().update({ query: { search: 'open' }, partial: true });
  };
  const updateMenu = async () => {
    const { settings } = await getBackendSrv().post(`${window.location.origin}/v1/Settings/Get`);
    setShowDBaaS(settings.dbaas_enabled);

    if (settings.alerting_enabled) {
      setMainLinks([...buildIntegratedAlertingMenuItem(mainLinks)]);
    }
  };

  useEffect(() => {
    if (config.bootData.user.isGrafanaAdmin) {
      updateMenu();
    }
  }, []);

  return (
    <div className="sidemenu__top">
      <TopSectionItem link={searchLink} onClick={onOpenSearch} />
      {mainLinks.map((link, index) => {
        return <TopSectionItem link={link} key={`${link.id}-${index}`} />;
      })}
      {showDBaaS && <TopSectionItem link={dbaasLink} />}
    </div>
  );
};

export default TopSection;
