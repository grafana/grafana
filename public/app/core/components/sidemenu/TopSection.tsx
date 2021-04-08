import React, { FC, useEffect, useMemo, useState } from 'react';
import _ from 'lodash';
import TopSectionItem from './TopSectionItem';
import config from '../../config';
import { getLocationSrv } from '@grafana/runtime';
import { NavModelItem } from '@grafana/data';
import { logger } from '@percona/platform-core';
import { buildIntegratedAlertingMenuItem } from './TopSection.utils';
import { LinkConfig } from './TopSection.types';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { isPmmAdmin } from 'app/percona/shared/helpers/permissions';

const TopSection: FC<any> = () => {
  const [showDBaaS, setShowDBaaS] = useState(false);
  const [showSTT, setShowSTT] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const navTree = _.cloneDeep(config.bootData.navTree) as NavModelItem[];
  const [mainLinks, setMainLinks] = useState(_.filter(navTree, (item) => !item.hideFromMenu));
  const searchLink = {
    text: 'Search',
    icon: 'search',
  };

  const linksConfig = useMemo<LinkConfig[]>(
    () => [
      {
        linkObject: {
          id: 'dbaas',
          icon: 'database',
          text: 'DBaaS',
          url: `${config.appSubUrl}/dbaas`,
        },
        show: showDBaaS,
      },
      // TODO remove comment when feature is ready to come out
      // {
      //   linkObject: {
      //     id: 'backup',
      //     icon: 'history',
      //     text: 'Backup',
      //     url: `${config.appSubUrl}/backup`,
      //   },
      //   show: showBackup,
      // },
      {
        linkObject: {
          id: 'database-checks',
          icon: 'percona-database-checks',
          text: 'Security Checks',
          url: `${config.appSubUrl}/pmm-database-checks`,
        },
        show: showSTT,
      },
    ],
    [showDBaaS, showBackup, showSTT, config]
  );

  const onOpenSearch = () => {
    getLocationSrv().update({ query: { search: 'open' }, partial: true });
  };
  const updateMenu = async () => {
    try {
      const settings = await SettingsService.getSettings();

      setShowDBaaS(!!settings.dbaasEnabled);
      setShowSTT(settings.sttEnabled);
      setShowBackup(settings.backupEnabled);

      if (settings.alertingEnabled) {
        setMainLinks([...buildIntegratedAlertingMenuItem(mainLinks)]);
      }
    } catch (e) {
      logger.error(e);
    }
  };

  useEffect(() => {
    if (isPmmAdmin(config.bootData.user)) {
      updateMenu();
    }
  }, []);

  return (
    <div className="sidemenu__top">
      <TopSectionItem link={searchLink} onClick={onOpenSearch} />
      {mainLinks.map((link, index) => {
        return <TopSectionItem link={link} key={`${link.id}-${index}`} />;
      })}
      {linksConfig.map(({ show, linkObject }) => show && <TopSectionItem link={linkObject} />)}
    </div>
  );
};

export default TopSection;
