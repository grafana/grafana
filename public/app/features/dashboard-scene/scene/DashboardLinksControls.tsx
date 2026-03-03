import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';

import { DashboardLinkRenderer } from './DashboardLinkRenderer';
import { DashboardScene } from './DashboardScene';

export interface Props {
  links: DashboardLink[];
  dashboard: DashboardScene;
}

export function DashboardLinksControls({ links, dashboard }: Props) {
  sceneGraph.getTimeRange(dashboard).useState();
  const uid = dashboard.state.uid;
  const { defaultLinksLoading } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const linksToDisplay = excludeControlMenuLinks(links);

  if (!uid || (!defaultLinksLoading && linksToDisplay.length === 0)) {
    return null;
  }

  return (
    <div className={styles.linksContainer}>
      {defaultLinksLoading && <Skeleton width={100} height={24} containerClassName={styles.skeletonContainer} />}
      {linksToDisplay.map((link: DashboardLink, index: number) => (
        <DashboardLinkRenderer link={link} dashboardUID={uid} key={`${link.title}-$${index}`} />
      ))}
    </div>
  );
}

function excludeControlMenuLinks(links: DashboardLink[]): DashboardLink[] {
  if (!links || links.length === 0) {
    return [];
  }

  return links.filter((link) => link.placement === undefined);
}

function getStyles(theme: GrafanaTheme2) {
  return {
    linksContainer: css({
      label: 'dashboard-links-controls',
      display: 'inline-flex',
      gap: theme.spacing(1),
      marginRight: theme.spacing(1),
      marginBottom: theme.spacing(1),
      flexWrap: 'wrap',
    }),
    skeletonContainer: css({
      display: 'inline-flex',
      lineHeight: 1,
    }),
  };
}
