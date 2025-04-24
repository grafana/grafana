import { css } from '@emotion/css';
import { useMemo } from 'react';
import { Link } from 'react-router-dom-v5-compat';

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

  return (
    <Link to={to} className={styles.container} data-testid={`scopes-dashboards-${id}`} role="treeitem">
      <Icon name={linkIcon} className={styles.icon} /> {title}
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
      alignItems: 'flex-start',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 0),
      textAlign: 'left',
      wordBreak: 'break-word',

      '&:last-child': css({
        paddingBottom: 0,
      }),
      '&:hover, &:focus': css({
        textDecoration: 'underline',
      }),
    }),
    icon: css({
      marginTop: theme.spacing(0.25),
    }),
  };
};
