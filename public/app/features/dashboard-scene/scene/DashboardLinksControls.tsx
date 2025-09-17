import { sceneGraph } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';

import { DashboardLinkRenderer } from './DashboardLinkRenderer';
import { DashboardScene } from './DashboardScene';

export interface Props {
  links: DashboardLink[];
  dashboard: DashboardScene;
}

export function DashboardLinksControls({ links, dashboard }: Props) {
  sceneGraph.getTimeRange(dashboard).useState();
  const uid = dashboard.state.uid;

  if (!links || !uid) {
    return null;
  }

  return (
    <>
      {links
        .filter((link) => link.placement === undefined)
        .map((link: DashboardLink, index: number) => (
          <DashboardLinkRenderer link={link} dashboardUID={uid} key={`${link.title}-$${index}`} />
        ))}
    </>
  );
}
