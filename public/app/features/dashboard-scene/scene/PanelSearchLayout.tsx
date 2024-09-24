import { useEffect } from 'react';

import { SceneGridLayout, VizPanel } from '@grafana/scenes';

import { activateInActiveParents } from '../utils/utils';

import { DashboardGridItem } from './DashboardGridItem';
import { DashboardScene } from './DashboardScene';

export interface Props {
  dashboard: DashboardScene;
  panelSearch: string;
}

export function PanelSearchLayout({ dashboard, panelSearch }: Props) {
  const { body } = dashboard.state;
  const panels: VizPanel[] = [];

  if (!(body instanceof SceneGridLayout)) {
    return <div>Non supported layout</div>;
  }

  for (const gridItem of body.state.children) {
    if (gridItem instanceof DashboardGridItem) {
      const panel = gridItem.state.body;
      if (panel.state.title.includes(panelSearch)) {
        panels.push(gridItem.state.body);
      }
    }
  }

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gridAutoRows: '320px' }}
    >
      {panels.map((panel) => (
        <PanelSearchHit key={panel.state.key} panel={panel} />
      ))}
    </div>
  );
}

function PanelSearchHit({ panel }: { panel: VizPanel }) {
  useEffect(() => activateInActiveParents(panel), [panel]);

  return <panel.Component model={panel} />;
}
