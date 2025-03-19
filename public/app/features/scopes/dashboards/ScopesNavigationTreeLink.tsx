import { css } from '@emotion/css';
import { Link } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

export interface ScopesNavigationTreeLinkProps {
  to: string;
  title: string;
  icon: IconName;
}

export function ScopesNavigationTreeLink({ to, title, icon }: ScopesNavigationTreeLinkProps) {
  const styles = useStyles2(getStyles);

  return (
    <Link to={to} className={styles.container} data-testid={`scopes-dashboards-${title}`} role="treeitem">
      <Icon name={icon} className={styles.icon} /> {title}
    </Link>
  );
}

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
      '&:hover': css({
        textDecoration: 'underline',
      }),
    }),
    icon: css({
      marginTop: theme.spacing(0.25),
    }),
  };
};
