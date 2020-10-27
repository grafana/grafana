import { PanelProps } from '@grafana/data';
import React, { useEffect, useState } from 'react';
import { DashListOptions } from './types';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchHit } from 'app/features/search/types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { CustomScrollbar, Icon } from '@grafana/ui';
import impressionSrv from 'app/core/services/impression_srv';
import take from 'lodash/take';

type Dashboard = DashboardSearchHit & { isSearchResult?: boolean; isRecent?: boolean };

interface DashboardGroup {
  show: boolean;
  header: string;
  dashboards: Dashboard[];
}

export function DashList(props: PanelProps<DashListOptions>) {
  const [dashboards, setDashboards] = useState<Record<number, Dashboard>>({});
  useEffect(() => {
    async function fetchDashboards() {
      let starredDashboards: Promise<Dashboard[]> = Promise.resolve([]);
      if (props.options.showStarred) {
        const params = { limit: props.options.maxItems, starred: 'true' };
        starredDashboards = getBackendSrv().search(params);
      }

      let recentDashboards: Promise<Dashboard[]> = Promise.resolve([]);
      if (props.options.showRecentlyViewed) {
        const dashIds = take(impressionSrv.getDashboardOpened(), props.options.maxItems);
        recentDashboards = getBackendSrv().search({ dashboardIds: dashIds, limit: props.options.maxItems });
      }

      let searchedDashboards: Promise<Dashboard[]> = Promise.resolve([]);
      if (props.options.showSearch) {
        const params = {
          limit: props.options.maxItems,
          query: props.options.query,
          folderIds: props.options.folderId,
          tag: props.options.tags,
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

      setDashboards(dashMap);
    }

    fetchDashboards();
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

  const { showStarred, showRecentlyViewed, showHeadings, showSearch } = props.options;

  const dashboardList = Object.values(dashboards);
  const dashboardGroups: DashboardGroup[] = [
    {
      header: 'Starred dashboards',
      dashboards: dashboardList.filter(dash => dash.isStarred),
      show: showStarred,
    },
    {
      header: 'Recently viewed dashboards',
      dashboards: dashboardList.filter(dash => dash.isRecent),
      show: showRecentlyViewed,
    },
    {
      header: 'Search',
      dashboards: dashboardList.filter(dash => dash.isSearchResult),
      show: showSearch,
    },
  ];

  return (
    <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
      {dashboardGroups.map(
        ({ show, header, dashboards }, i) =>
          show && (
            <div className="dashlist-section" key={`dash-group-${i}`}>
              {showHeadings && <h6 className="dashlist-section-header">{header}</h6>}
              <ul>
                {dashboards.map(dash => (
                  <li className="dashlist-item" key={`dash-${dash.id}`}>
                    <div className={`dashlist-link dashlist-link-${dash.type}`}>
                      <div className="dashlist-link-body">
                        <a className="dashlist-title" href={dash.url}>
                          {dash.title}
                        </a>
                        {dash.folderTitle && <div className="dashlist-folder">{dash.folderTitle}</div>}
                      </div>
                      <span className="dashlist-star" onClick={e => toggleDashboardStar(e, dash)}>
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
