import { css, cx } from '@emotion/css';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, IconName, locationUtil } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

export interface ScopesNavigationTreeLinkProps {
  to: string;
  title: string;
  id: string;
}

export function ScopesNavigationTreeLink({ to, title, id }: ScopesNavigationTreeLinkProps) {
  const styles = useStyles2(getStyles);
  const linkIcon = useMemo(() => getLinkIcon(to), [to]);
  const isDashboard = to.startsWith('/d/');

  // For dashboards, the title is appended to the path. We need to diregard this
  const currentPath = isDashboard ? useLocation().pathname.split('/').slice(0, 3).join('/') : useLocation().pathname;

  const isCurrent = to.startsWith(currentPath);

  return (
    <Link
      to={to}
      className={cx(styles.container, isCurrent && styles.current)}
      data-testid={`scopes-dashboards-${id}`}
      role="treeitem"
      key={id}
    >
      <Icon name={linkIcon} /> {title}
    </Link>
  );
}

function getLinkIcon(to: string) {
  // Strip base URL and normalize path
  const normalizedPath = locationUtil.stripBaseFromUrl(to);
  for (const [key, value] of linkMap.entries()) {
    if (normalizedPath.startsWith(key)) {
      return value;
    }
  }

  return 'link';
}

const linkMap = new Map<string, IconName>([
  ['http', 'external-link-alt'],
  ['/d', 'apps'],
  ['/explore/metrics', 'drilldown'],
  ['/a/grafana-metricsdrilldown-app/', 'drilldown'],
  ['/a/grafana-lokiexplore-app/', 'drilldown'],
  ['/a/grafana-exploretraces-app/', 'drilldown'],
  ['/a/grafana-pyroscope-app/', 'drilldown'],
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
