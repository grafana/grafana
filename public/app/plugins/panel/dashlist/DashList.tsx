import { take } from 'lodash';
import { SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { useThrottle } from 'react-use';

import { InterpolateFunction, PanelProps, textUtil } from '@grafana/data';
import { useStyles2, IconButton, ScrollContainer } from '@grafana/ui';
import { updateNavIndex } from 'app/core/actions';
import { getConfig } from 'app/core/config';
import { ID_PREFIX, setStarred } from 'app/core/reducers/navBarTree';
import { removeNavIndex } from 'app/core/reducers/navModel';
import { getBackendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardSearchItem } from 'app/features/search/types';
import { useDispatch, useSelector } from 'app/types/store';

import { Options } from './panelcfg.gen';
import { getStyles } from './styles';
import { useDashListUrlParams } from './utils';

type Dashboard = DashboardSearchItem & { id?: number; isSearchResult?: boolean; isRecent?: boolean };

interface DashboardGroup {
  show: boolean;
  header: string;
  dashboards: Dashboard[];
}

async function fetchDashboards(options: Options, replaceVars: InterpolateFunction) {
  let starredDashboards: Promise<DashboardSearchItem[]> = Promise.resolve([]);

  if (options.showStarred) {
    const params = { limit: options.maxItems, starred: 'true' };
    starredDashboards = getBackendSrv().search(params);
  }

  let recentDashboards: Promise<DashboardSearchItem[]> = Promise.resolve([]);
  let dashUIDs: string[] = [];
  if (options.showRecentlyViewed) {
    let uids = await impressionSrv.getDashboardOpened();
    dashUIDs = take<string>(uids, options.maxItems);
    recentDashboards = getBackendSrv().search({ dashboardUIDs: dashUIDs, limit: options.maxItems });
  }

  let searchedDashboards: Promise<DashboardSearchItem[]> = Promise.resolve([]);
  if (options.showSearch) {
    const uid = options.folderUID === '' ? 'general' : options.folderUID;
    const params = {
      limit: options.maxItems,
      query: replaceVars(options.query, {}, 'text'),
      folderUIDs: uid,
      tag: options.tags.map((tag: string) => replaceVars(tag, {}, 'text')),
      type: 'dash-db',
    };

    searchedDashboards = getBackendSrv().search(params);
  }

  const [starred, searched, recent] = await Promise.all([starredDashboards, searchedDashboards, recentDashboards]);

  // We deliberately deal with recent dashboards first so that the order of dash IDs is preserved
  let dashMap = new Map<string, Dashboard>();
  for (const dashUID of dashUIDs) {
    const dash = recent.find((d) => d.uid === dashUID);
    if (dash) {
      dashMap.set(dashUID, { ...dash, isRecent: true });
    }
  }

  searched.forEach((dash) => {
    if (!dash.uid) {
      return;
    }
    if (dashMap.has(dash.uid)) {
      dashMap.get(dash.uid)!.isSearchResult = true;
    } else {
      dashMap.set(dash.uid, { ...dash, isSearchResult: true });
    }
  });

  starred.forEach((dash) => {
    if (!dash.uid) {
      return;
    }
    if (dashMap.has(dash.uid)) {
      dashMap.get(dash.uid)!.isStarred = true;
    } else {
      dashMap.set(dash.uid, { ...dash, isStarred: true });
    }
  });

  return dashMap;
}

export function DashList(props: PanelProps<Options>) {
  const [dashboards, setDashboards] = useState(new Map<string, Dashboard>());
  const dispatch = useDispatch();
  const navIndex = useSelector((state) => state.navIndex);

  const throttledRenderCount = useThrottle(props.renderCounter, 5000);

  useEffect(() => {
    fetchDashboards(props.options, props.replaceVariables).then((dashes) => {
      setDashboards(dashes);
    });
  }, [props.options, props.replaceVariables, throttledRenderCount]);

  const toggleDashboardStar = async (e: SyntheticEvent, dash: Dashboard) => {
    const { uid, title, url } = dash;
    e.preventDefault();
    e.stopPropagation();

    const isStarred = await getDashboardSrv().starDashboard(dash.uid, dash.isStarred);
    const updatedDashboards = new Map(dashboards);
    updatedDashboards.set(dash?.uid ?? '', { ...dash, isStarred });
    setDashboards(updatedDashboards);
    dispatch(setStarred({ id: uid ?? '', title, url, isStarred }));

    const starredNavItem = navIndex['starred'];
    if (isStarred) {
      starredNavItem.children?.push({
        id: ID_PREFIX + uid,
        text: title,
        url: url ?? '',
        parentItem: starredNavItem,
      });
    } else {
      dispatch(removeNavIndex(ID_PREFIX + uid));
      const indexToRemove = starredNavItem.children?.findIndex((element) => element.id === ID_PREFIX + uid);
      if (indexToRemove) {
        starredNavItem.children?.splice(indexToRemove, 1);
      }
    }
    dispatch(updateNavIndex(starredNavItem));
  };

  const [starredDashboards, recentDashboards, searchedDashboards] = useMemo(() => {
    const dashboardList = [...dashboards.values()];
    return [
      dashboardList.filter((dash) => dash.isStarred).sort((a, b) => a.title.localeCompare(b.title)),
      dashboardList.filter((dash) => dash.isRecent),
      dashboardList.filter((dash) => dash.isSearchResult).sort((a, b) => a.title.localeCompare(b.title)),
    ];
  }, [dashboards]);

  const { showStarred, showRecentlyViewed, showHeadings, showFolderNames, showSearch, showDescriptions } = props.options;

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
  const urlParams = useDashListUrlParams(props);

  const renderList = (dashboards: Dashboard[]) => (
    <ul>
      {dashboards.map((dash) => {
        let url = dash.url + urlParams;
        url = getConfig().disableSanitizeHtml ? url : textUtil.sanitizeUrl(url);

        return (
          <li className={css.dashlistItem} key={`dash-${dash.uid}`}>
            <div className={css.dashlistLink}>
              <div className={css.dashlistLinkBody}>
                <a className={css.dashlistTitle} href={url}>
                  {dash.title}
                </a>
                {showDescriptions && dash.description && <div className={css.dashlistDescription}>{dash.description}</div>}
                {showFolderNames && dash.folderTitle && <div className={css.dashlistFolder}>{dash.folderTitle}</div>}
              </div>
              <IconButton
                tooltip={dash.isStarred ? `Unmark "${dash.title}" as favorite` : `Mark "${dash.title}" as favorite`}
                name={dash.isStarred ? 'favorite' : 'star'}
                iconType={dash.isStarred ? 'mono' : 'default'}
                onClick={(e) => toggleDashboardStar(e, dash)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <ScrollContainer minHeight="100%">
      {dashboardGroups.map(
        ({ show, header, dashboards }, i) =>
          show && (
            <div className={css.dashlistSection} key={`dash-group-${i}`}>
              {showHeadings && <h6 className={css.dashlistSectionHeader}>{header}</h6>}
              {renderList(dashboards)}
            </div>
          )
      )}
    </ScrollContainer>
  );
}
