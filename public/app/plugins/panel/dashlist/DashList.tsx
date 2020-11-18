import React, { useEffect, useMemo, useState } from 'react';
import take from 'lodash/take';

import { PanelProps } from '@grafana/data';
import { CustomScrollbar, Icon, useStyles } from '@grafana/ui';

import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import impressionSrv from 'app/core/services/impression_srv';
import { DashboardSearchHit } from 'app/features/search/types';
import { DashListOptions } from './types';
import { getStyles } from './styles';

type Dashboard = DashboardSearchHit & { isSearchResult?: boolean; isRecent?: boolean };

interface DashboardGroup {
  show: boolean;
  header: string;
  dashboards: Dashboard[];
}

async function fetchDashboards(options: DashListOptions) {
  let starredDashboards: Promise<Dashboard[]> = Promise.resolve([]);
  if (options.showStarred) {
    const params = { limit: options.maxItems, starred: 'true' };
    starredDashboards = getBackendSrv().search(params);
  }

  let recentDashboards: Promise<Dashboard[]> = Promise.resolve([]);
  if (options.showRecentlyViewed) {
    const dashIds = take(impressionSrv.getDashboardOpened(), options.maxItems);
    recentDashboards = getBackendSrv().search({ dashboardIds: dashIds, limit: options.maxItems });
  }

  let searchedDashboards: Promise<Dashboard[]> = Promise.resolve([]);
  if (options.showSearch) {
    const params = {
      limit: options.maxItems,
      query: options.query,
      folderIds: options.folderId,
      tag: options.tags,
      type: 'dash-db',
    };

    searchedDashboards = getBackendSrv().search(params);
  }

  const [starred, searched, recent] = await Promise.all([starredDashboards, searchedDashboards, recentDashboards]);
  const dashMap = starred.reduce(
    (acc, dash) => Object.assign(acc, { [dash.id]: dash }),
    {} as Record<number, Dashboard>
  );

  searched.forEach(dash => {
    if (dashMap.hasOwnProperty(dash.id)) {
      dashMap[dash.id].isSearchResult = true;
    } else {
      dashMap[dash.id] = { ...dash, isSearchResult: true };
    }
  });

  recent.forEach(dash => {
    if (dashMap.hasOwnProperty(dash.id)) {
      dashMap[dash.id].isRecent = true;
    } else {
      dashMap[dash.id] = { ...dash, isRecent: true };
    }
  });

  return dashMap;
}

export function DashList(props: PanelProps<DashListOptions>) {
  const [dashboards, setDashboards] = useState<Record<number, Dashboard>>({});
  useEffect(() => {
    fetchDashboards(props.options).then(dashes => {
      setDashboards(dashes);
    });
  }, [
    props.options.showSearch,
    props.options.showStarred,
    props.options.showRecentlyViewed,
    props.options.maxItems,
    props.options.query,
    props.options.tags,
    props.options.folderId,
  ]);

  const toggleDashboardStar = async (e: React.SyntheticEvent, dash: Dashboard) => {
    e.preventDefault();
    e.stopPropagation();

    const isStarred = await getDashboardSrv().starDashboard(dash.id.toString(), dash.isStarred);
    setDashboards(Object.assign({}, dashboards, { [dash.id]: { ...dash, isStarred } }));
  };

  const [starredDashboards, recentDashboards, searchedDashboards] = useMemo(() => {
    const dashboardList = Object.values(dashboards);
    return [
      dashboardList.filter(dash => dash.isStarred),
      dashboardList.filter(dash => dash.isRecent),
      dashboardList.filter(dash => dash.isSearchResult),
    ];
  }, [dashboards]);

  const { showStarred, showRecentlyViewed, showHeadings, showSearch } = props.options;

  const dashboardGroups: DashboardGroup[] = [
    {
      header: 'Starred dashboards',
      dashboards: starredDashboards,
      show: showStarred,
    },
    {
      header: 'Recently viewed dashboards',
      dashboards: recentDashboards,
      show: showRecentlyViewed,
    },
    {
      header: 'Search',
      dashboards: searchedDashboards,
      show: showSearch,
    },
  ];

  const css = useStyles(getStyles);
  return (
    <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
      {dashboardGroups.map(
        ({ show, header, dashboards }, i) =>
          show && (
            <div className={css.dashlistSection} key={`dash-group-${i}`}>
              {showHeadings && <h6 className={css.dashlistSectionHeader}>{header}</h6>}
              <ul>
                {dashboards.map(dash => (
                  <li className={css.dashlistItem} key={`dash-${dash.id}`}>
                    <div className={css.dashlistLink}>
                      <div className={css.dashlistLinkBody}>
                        <a className={css.dashlistTitle} href={dash.url}>
                          {dash.title}
                        </a>
                        {dash.folderTitle && <div className={css.dashlistFolder}>{dash.folderTitle}</div>}
                      </div>
                      <span className={css.dashlistStar} onClick={e => toggleDashboardStar(e, dash)}>
                        <Icon name={dash.isStarred ? 'favorite' : 'star'} type={dash.isStarred ? 'mono' : 'default'} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
      )}
    </CustomScrollbar>
  );
}
