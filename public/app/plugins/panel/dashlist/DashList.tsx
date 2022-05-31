import { css, cx } from '@emotion/css';
import { take } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';

import { GrafanaTheme2, InterpolateFunction, PanelProps } from '@grafana/data';
import { CustomScrollbar, stylesFactory, useStyles2 } from '@grafana/ui';
import { Icon, IconProps } from '@grafana/ui/src/components/Icon/Icon';
import { getFocusStyles } from '@grafana/ui/src/themes/mixins';
import { setStarred } from 'app/core/reducers/navBarTree';
import { getBackendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { SearchCard } from 'app/features/search/components/SearchCard';
import { DashboardSearchHit } from 'app/features/search/types';

import { PanelLayout, PanelOptions } from './models.gen';
import { getStyles } from './styles';

type Dashboard = DashboardSearchHit & { isSearchResult?: boolean; isRecent?: boolean };

interface DashboardGroup {
  show: boolean;
  header: string;
  dashboards: Dashboard[];
}

async function fetchDashboards(options: PanelOptions, replaceVars: InterpolateFunction) {
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

export function DashList(props: PanelProps<PanelOptions>) {
  const [dashboards, setDashboards] = useState(new Map<number, Dashboard>());
  const dispatch = useDispatch();
  useEffect(() => {
    fetchDashboards(props.options, props.replaceVariables).then((dashes) => {
      setDashboards(dashes);
    });
  }, [props.options, props.replaceVariables, props.renderCounter]);

  const toggleDashboardStar = async (e: React.SyntheticEvent, dash: Dashboard) => {
    const { uid, title, url } = dash;
    e.preventDefault();
    e.stopPropagation();

    const isStarred = await getDashboardSrv().starDashboard(dash.id.toString(), dash.isStarred);
    const updatedDashboards = new Map(dashboards);
    updatedDashboards.set(dash.id, { ...dash, isStarred });
    setDashboards(updatedDashboards);
    dispatch(setStarred({ id: uid ?? '', title, url, isStarred }));
  };

  const [starredDashboards, recentDashboards, searchedDashboards] = useMemo(() => {
    const dashboardList = [...dashboards.values()];
    return [
      dashboardList.filter((dash) => dash.isStarred).sort((a, b) => a.title.localeCompare(b.title)),
      dashboardList.filter((dash) => dash.isRecent),
      dashboardList.filter((dash) => dash.isSearchResult).sort((a, b) => a.title.localeCompare(b.title)),
    ];
  }, [dashboards]);

  const { showStarred, showRecentlyViewed, showHeadings, showSearch, layout } = props.options;

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

  const renderList = (dashboards: Dashboard[]) => (
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
            <IconToggle
              aria-label={`Star dashboard "${dash.title}".`}
              className={css.dashlistStar}
              enabled={{ name: 'favorite', type: 'mono' }}
              disabled={{ name: 'star', type: 'default' }}
              checked={dash.isStarred}
              onClick={(e) => toggleDashboardStar(e, dash)}
            />
          </div>
        </li>
      ))}
    </ul>
  );

  const renderPreviews = (dashboards: Dashboard[]) => (
    <ul className={css.gridContainer}>
      {dashboards.map((dash) => (
        <li key={dash.uid}>
          <SearchCard item={dash} />
        </li>
      ))}
    </ul>
  );

  return (
    <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
      {dashboardGroups.map(
        ({ show, header, dashboards }, i) =>
          show && (
            <div className={css.dashlistSection} key={`dash-group-${i}`}>
              {showHeadings && <h6 className={css.dashlistSectionHeader}>{header}</h6>}
              {layout === PanelLayout.Previews ? renderPreviews(dashboards) : renderList(dashboards)}
            </div>
          )
      )}
    </CustomScrollbar>
  );
}

interface IconToggleProps extends Partial<IconProps> {
  enabled: IconProps;
  disabled: IconProps;
  checked: boolean;
}

function IconToggle({
  enabled,
  disabled,
  checked,
  onClick,
  className,
  'aria-label': ariaLabel,
  ...otherProps
}: IconToggleProps) {
  const toggleCheckbox = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      onClick?.(e);
    },
    [onClick]
  );

  const iconPropsOverride = checked ? enabled : disabled;
  const iconProps = { ...otherProps, ...iconPropsOverride };
  const styles = useStyles2(getCheckboxStyles);
  return (
    <label className={styles.wrapper}>
      <input
        type="checkbox"
        defaultChecked={checked}
        onClick={toggleCheckbox}
        className={styles.checkBox}
        aria-label={ariaLabel}
      />
      <Icon className={cx(styles.icon, className)} {...iconProps} />
    </label>
  );
}

export const getCheckboxStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      alignSelf: 'center',
      cursor: 'pointer',
      zIndex: 100,
    }),
    checkBox: css({
      appearance: 'none',
      '&:focus-visible + *': {
        ...getFocusStyles(theme),
        borderRadius: theme.shape.borderRadius(1),
      },
    }),
    icon: css({
      marginBottom: 0,
      verticalAlign: 'baseline',
      display: 'flex',
    }),
  };
});
