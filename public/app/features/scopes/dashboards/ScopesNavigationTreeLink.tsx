import { css, cx } from '@emotion/css';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, IconName, locationUtil, UrlQueryMap, urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Icon, useStyles2 } from '@grafana/ui';

import { useScopesServices } from '../ScopesContextProvider';

import { isCurrentPath, normalizePath, serializeFolderPath } from './scopeNavgiationUtils';

export interface ScopesNavigationTreeLinkProps {
  subScope?: string;
  to: string;
  title: string;
  id: string;
  subScopePath?: string[];
}

export function ScopesNavigationTreeLink({ subScope, to, title, id, subScopePath }: ScopesNavigationTreeLinkProps) {
  const styles = useStyles2(getStyles);
  const linkIcon = useMemo(() => getLinkIcon(to), [to]);
  const locPathname = useLocation().pathname;
  const services = useScopesServices();
  // Ignore query params
  const isCurrent = isCurrentPath(locPathname, to);

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (subScope) {
      e.preventDefault(); // Prevent default Link navigation

      // Set current scope to navigation scope and subScope to scope
      const currentScope = services?.scopesSelectorService?.state.appliedScopes[0]?.scopeId;
      const currentNavigationScope = services?.scopesDashboardsService?.state.navigationScope;

      // Parse the URL to extract path and existing query params
      const url = new URL(to, window.location.origin);
      const pathname = url.pathname;
      const searchParams = new URLSearchParams(url.search);
      if (!currentNavigationScope && currentScope) {
        searchParams.set('navigation_scope', currentScope);
        await services?.scopesDashboardsService?.setNavigationScope(
          currentScope,
          undefined,
          subScopePath && subScopePath.length > 0 ? subScopePath : undefined
        );
      }

      // Update query params with the new subScope
      searchParams.set('scopes', subScope);

      // Set nav_scope_path to the subScopePath
      searchParams.set('nav_scope_path', subScopePath ? serializeFolderPath(subScopePath) : '');
      // Remove scope_node and scope_parent since we're changing to a subScope
      searchParams.delete('scope_node');
      searchParams.delete('scope_parent');

      // Convert URLSearchParams to query map object for urlUtil.renderUrl
      const queryMap: UrlQueryMap = {};
      searchParams.forEach((value, key) => {
        queryMap[key] = value;
      });

      // Build the new URL safely using urlUtil.renderUrl
      const newUrl = urlUtil.renderUrl(pathname, queryMap);

      // Change scopes first (this updates the state)
      services?.scopesSelectorService?.changeScopes([subScope], undefined, undefined, false);

      // Then navigate to the URL with updated query params
      locationService.push(newUrl);
    }
  };

  return (
    <Link
      to={to}
      aria-current={isCurrent ? 'page' : undefined}
      className={cx(styles.container, isCurrent && styles.current)}
      data-testid={`scopes-dashboards-${id}`}
      onClick={handleClick}
      role="treeitem"
      key={id}
    >
      <Icon name={linkIcon} /> {title}
    </Link>
  );
}

function getLinkIcon(to: string) {
  // Check for external links before stripping base (stripBaseFromUrl removes http:// for same-origin URLs)
  if (to.startsWith('http')) {
    return 'external-link-alt';
  }

  // Strip base URL and normalize path (remove query params and hash)
  const baseStripped = locationUtil.stripBaseFromUrl(to);
  const normalizedPath = normalizePath(baseStripped);

  // Check for dashboard paths with startsWith (e.g., /d/dashboard-id)
  if (normalizedPath.startsWith('/d')) {
    return 'apps';
  }

  // Use direct Map lookup for exact path matches
  return linkMap.get(normalizedPath) ?? 'link';
}

const linkMap = new Map<string, IconName>([
  ['/explore/metrics', 'drilldown'],
  ['/a/grafana-metricsdrilldown-app', 'drilldown'],
  ['/a/grafana-lokiexplore-app', 'drilldown'],
  ['/a/grafana-exploretraces-app', 'drilldown'],
  ['/a/grafana-pyroscope-app', 'drilldown'],
]);

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.75, 0),
      textAlign: 'left',
      paddingLeft: theme.spacing(1),

      wordBreak: 'break-word',

      '&:hover, &:focus': css({
        textDecoration: 'underline',
      }),
    }),
    current: css({
      position: 'relative',
      background: theme.colors.action.selected,
      borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
      '&::before': {
        backgroundImage: theme.colors.gradients.brandVertical,
        borderRadius: theme.shape.radius.default,
        content: '" "',
        display: 'block',
        height: '100%',
        position: 'absolute',
        width: theme.spacing(0.5),
        top: 0,
        left: 0,
      },
    }),
  };
};
