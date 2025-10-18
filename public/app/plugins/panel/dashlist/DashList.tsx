import { take } from 'lodash';
import { SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { useThrottle } from 'react-use';

import { InterpolateFunction, PanelProps, textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useStyles2, IconButton, ScrollContainer, Box, Text, EmptyState, Link } from '@grafana/ui';

import { getConfig } from 'app/core/config';
import { ID_PREFIX, setStarred } from 'app/core/reducers/navBarTree';
import { removeNavIndex, updateNavIndex } from 'app/core/reducers/navModel';
import impressionSrv from 'app/core/services/impression_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { DashboardQueryResult, LocationInfo, QueryResponse, SearchQuery } from 'app/features/search/service/types';
import { StarToolbarButtonApiServer } from 'app/features/stars/StarToolbarButton';
import { useDispatch, useSelector } from 'app/types/store';

import { Options } from './panelcfg.gen';
import { getStyles } from './styles';
import { useDashListUrlParams } from './utils';

type Dashboard = DashboardQueryResult & {
  isSearchResult?: boolean;
  isRecent?: boolean;
  isStarred?: boolean;
};

interface DashboardGroup {
  show: boolean;
  header: string;
  dashboards: Dashboard[];
}

async function fetchDashboards(options: Options, replaceVars: InterpolateFunction) {
  const searcher = getGrafanaSearcher();
  let starredDashboards: Promise<QueryResponse | void> = Promise.resolve();
  let recentDashboards: Promise<QueryResponse | void> = Promise.resolve();
  let searchedDashboards: Promise<QueryResponse | void> = Promise.resolve();

  if (options.showStarred) {
    const params: SearchQuery = { limit: options.maxItems, starred: true };
    starredDashboards = searcher.starred(params);
  }

  let dashUIDs: string[] = [];
  if (options.showRecentlyViewed) {
    let uids = await impressionSrv.getDashboardOpened();
    dashUIDs = take<string>(uids, options.maxItems);

    recentDashboards = searcher.search({ uid: dashUIDs, limit: options.maxItems, kind: ['dashboard'] });
  }

  if (options.showSearch) {
    const uid = options.folderUID === '' ? 'general' : options.folderUID;
    const params: SearchQuery = {
      limit: options.maxItems,
      query: replaceVars(options.query, {}, 'text'),
      location: uid,
      tags: options.tags.map((tag: string) => replaceVars(tag, {}, 'text')),
      kind: ['dashboard'],
    };

    searchedDashboards = searcher.search(params);
  }

  const [starred, searched, recent] = await Promise.allSettled([
    starredDashboards,
    searchedDashboards,
    recentDashboards,
  ]);

  // We deliberately deal with recent dashboards first so that the order of dash IDs is preserved
  let dashMap = new Map<string, DashboardQueryResult>();
  if (recent && recent.status === 'fulfilled') {
    for (const dashUID of dashUIDs) {
      const dash = recent.value?.view.find((d: DashboardQueryResult): d is DashboardQueryResult => {
        return d.uid === dashUID;
      });
      if (dash) {
        dashMap.set(dashUID, { ...dash, title: dash.name, isRecent: true });
      }
    }
  }

  if (searched && searched.status === 'fulfilled') {
    searched?.value?.view.forEach((dash) => {
      if (!dash.uid) {
        return;
      }
      if (dashMap.has(dash.uid)) {
        dashMap.get(dash.uid)!.isSearchResult = true;
      } else {
        dashMap.set(dash.uid, { ...dash, isSearchResult: true });
      }
    });
  }

  if (starred && starred.status === 'fulfilled') {
    starred?.value?.view.forEach((dash) => {
      if (!dash.uid) {
        return;
      }
      if (dashMap.has(dash.uid)) {
        dashMap.get(dash.uid)!.isStarred = true;
      } else {
        dashMap.set(dash.uid, { ...dash, isStarred: true });
      }
    });
  }

  return dashMap;
}

async function fetchDashboardFolders() {
  return getGrafanaSearcher().getLocationInfo();
}

const collator = new Intl.Collator();

export function DashList(props: PanelProps<Options>) {
  const [dashboards, setDashboards] = useState(new Map<string, Dashboard>());
  const [foldersTitleMap, setFoldersTitleMap] = useState<Record<string, LocationInfo>>({});
  const dispatch = useDispatch();
  const navIndex = useSelector((state) => state.navIndex);

  const throttledRenderCount = useThrottle(props.renderCounter, 5000);

  useEffect(() => {
    fetchDashboards(props.options, props.replaceVariables).then((dashes) => {
      setDashboards(dashes);
    });
  }, [props.options, props.replaceVariables, throttledRenderCount]);

  useEffect(() => {
    if (props.options.showFolderNames && dashboards.size > 0) {
      fetchDashboardFolders().then((locationInfo) => {
        setFoldersTitleMap(locationInfo);
      });
    }
  }, [props.options.showFolderNames, dashboards]);

  const toggleDashboardStar = async (e: SyntheticEvent, dash: Dashboard) => {
    const { uid, name, url } = dash;
    e.preventDefault();
    e.stopPropagation();

    const isStarred = await getDashboardSrv().starDashboard(dash.uid, Boolean(dash.isStarred));
    const updatedDashboards = new Map(dashboards);
    updatedDashboards.set(dash?.uid ?? '', { ...dash, isStarred });
    setDashboards(updatedDashboards);
    dispatch(setStarred({ id: uid ?? '', title: name, url, isStarred }));

    const starredNavItem = navIndex.starred;
    if (isStarred) {
      starredNavItem.children?.push({
        id: ID_PREFIX + uid,
        text: name,
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
    const dashboardsGroupsMap: Record<string, Dashboard[]> = {
      starred: [],
      recent: [],
      searched: [],
    };

    for (const dash of dashboardList) {
      if (dash.isStarred) {
        dashboardsGroupsMap.starred.push(dash);
      }
      if (dash.isRecent) {
        dashboardsGroupsMap.recent.push(dash);
      }
      if (dash.isSearchResult) {
        dashboardsGroupsMap.searched.push(dash);
      }
    }
    return [
      dashboardsGroupsMap.starred.sort((a, b) => collator.compare(a.name, b.name)),
      dashboardsGroupsMap.recent,
      dashboardsGroupsMap.searched.sort((a, b) => collator.compare(a.name, b.name)),
    ];
  }, [dashboards]);

  const { showStarred, showRecentlyViewed, showHeadings, showFolderNames, showSearch } = props.options;

  const dashboardGroups: DashboardGroup[] = [
    {
      header: t('panel.dashlist.starred-dashboards', 'Starred dashboards'),
      dashboards: starredDashboards,
      show: showStarred,
    },
    {
      header: t('panel.dashlist.recently-viewed-dashboards', 'Recently viewed dashboards'),
      dashboards: recentDashboards,
      show: showRecentlyViewed,
    },
    {
      header: t('panel.dashlist.search', 'Search'),
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
        const markAsStarredText = t('panel.dashlist.mark-as-starred', 'Mark "{{title}}" as favorite', {
          title: dash.title,
        });
        const unmarkAsStarredText = t('panel.dashlist.unmark-as-starred', 'Unmark "{{title}}" as favorite', {
          title: dash.title,
        });

        const locationInfo = showFolderNames && dash.location ? foldersTitleMap[dash.location] : undefined;
        return (
          <li key={`dash-${dash.uid}`}>
            <div className={css.dashlistLink}>
              <Box flex={1}>
                <Link href={url}>{dash.name}</Link>
                {showFolderNames && locationInfo && (
                  <Text color="secondary" variant="bodySmall" element="p">
                    {locationInfo?.name}
                  </Text>
                )}
              </Box>
              {config.featureToggles.starsFromAPIServer ? (
                <StarToolbarButtonApiServer group="dashboard.grafana.app" kind="Dashboard" id={dash.uid ?? ''} />
              ) : (
                <IconButton
                  tooltip={dash.isStarred ? unmarkAsStarredText : markAsStarredText}
                  name={dash.isStarred ? 'favorite' : 'star'}
                  iconType={dash.isStarred ? 'mono' : 'default'}
                  onClick={(e) => toggleDashboardStar(e, dash)}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  const showEmptyState = dashboardGroups.every(({ show }) => !show);

  return (
    <ScrollContainer minHeight="100%">
      {showEmptyState && (
        <EmptyState
          hideImage
          variant="call-to-action"
          message={t('panel.dashlist.empty-state-message', 'No dashboard groups configured')}
        />
      )}
      {dashboardGroups.map(
        ({ show, header, dashboards }, i) =>
          show && (
            <Box marginBottom={2} paddingTop={0.5} key={`dash-group-${i}`}>
              {showHeadings && (
                <Box marginRight={1} paddingX={1} paddingY={0.25}>
                  <Text variant="h6" element="h6">
                    {header}
                  </Text>
                </Box>
              )}
              {renderList(dashboards)}
            </Box>
          )
      )}
    </ScrollContainer>
  );
}
