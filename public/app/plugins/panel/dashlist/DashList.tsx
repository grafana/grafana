import React, { useEffect, useMemo, useState } from 'react';
import { take } from 'lodash';

import { InterpolateFunction, PanelProps } from '@grafana/data';
import { CustomScrollbar, Icon, useStyles2 } from '@grafana/ui';

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

async function fetchDashboards(options: DashListOptions, replaceVars: InterpolateFunction) {
  let starredDashboards: Promise<Dashboard[]> = Promise.resolve([]);
  if (options.showStarred) {
    const params = { limit: options.maxItems, starred: 'true' };
    starredDashboards = getBackendSrv().search(params);
  }

  let recentDashboards: Promise<Dashboard[]> = Promise.resolve([]);
  let dashIds: number[] = [];
  if (options.showRecentlyViewed) {
    dashIds = take<number>(impressionSrv.getDashboardOpened(), options.maxItems);
    recentDashboards = getBackendSrv().search({ dashboardIds: dashIds, limit: options.maxItems });
  }

  let searchedDashboards: Promise<Dashboard[]> = Promise.resolve([]);
  if (options.showSearch) {
    const params = {
      limit: options.maxItems,
      query: replaceVars(options.query, {}, 'text'),
      folderIds: options.folderId,
      tag: options.tags.map((tag: string) => replaceVars(tag, {}, 'text')),
      type: 'dash-db',
    };

    searchedDashboards = getBackendSrv().search(params);
  }

  const [starred, searched, recent] = await Promise.all([starredDashboards, searchedDashboards, recentDashboards]);

  // We deliberately deal with recent dashboards first so that the order of dash IDs is preserved
  let dashMap = new Map<number, Dashboard>();
  for (const dashId of dashIds) {
    const dash = recent.find((d) => d.id === dashId);
    if (dash) {
      dashMap.set(dashId, { ...dash, isRecent: true });
    }
  }

  searched.forEach((dash) => {
    if (dashMap.has(dash.id)) {
      dashMap.get(dash.id)!.isSearchResult = true;
    } else {
      dashMap.set(dash.id, { ...dash, isSearchResult: true });
    }
  });

  starred.forEach((dash) => {
    if (dashMap.has(dash.id)) {
      dashMap.get(dash.id)!.isStarred = true;
    } else {
      dashMap.set(dash.id, { ...dash, isStarred: true });
    }
  });

  return dashMap;
}

export function DashList(props: PanelProps<DashListOptions>) {
  const [dashboards, setDashboards] = useState(new Map<number, Dashboard>());
  useEffect(() => {
    fetchDashboards(props.options, props.replaceVariables).then((dashes) => {
      setDashboards(dashes);
    });
  }, [props.options, props.replaceVariables, props.renderCounter]);

  const toggleDashboardStar = async (e: React.SyntheticEvent, dash: Dashboard) => {
    e.preventDefault();
    e.stopPropagation();

    const isStarred = await getDashboardSrv().starDashboard(dash.id.toString(), dash.isStarred);
    const updatedDashboards = new Map(dashboards);
    updatedDashboards.set(dash.id, { ...dash, isStarred });
    setDashboards(updatedDashboards);
  };

  const [starredDashboards, recentDashboards, searchedDashboards] = useMemo(() => {
    const dashboardList = [...dashboards.values()];
    return [
      dashboardList.filter((dash) => dash.isStarred).sort((a, b) => a.title.localeCompare(b.title)),
      dashboardList.filter((dash) => dash.isRecent),
      dashboardList.filter((dash) => dash.isSearchResult).sort((a, b) => a.title.localeCompare(b.title)),
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

  const css = useStyles2(getStyles);
  return (
    <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
      {dashboardGroups.map(
        ({ show, header, dashboards }, i) =>
          show && (
            <div className={css.dashlistSection} key={`dash-group-${i}`}>
              {showHeadings && <h6 className={css.dashlistSectionHeader}>{header}</h6>}
              <ul>
                {dashboards.map((dash) => (
                  <li className={css.dashlistItem} key={`dash-${dash.id}`}>
                    <div className={css.dashlistLink}>
                      <div className={css.dashlistLinkBody}>
                        <a className={css.dashlistTitle} href={dash.url}>
                          {dash.title}
                        </a>
                        {dash.folderTitle && <div className={css.dashlistFolder}>{dash.folderTitle}</div>}
                      </div>
                      <span className={css.dashlistStar} onClick={(e) => toggleDashboardStar(e, dash)}>
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
