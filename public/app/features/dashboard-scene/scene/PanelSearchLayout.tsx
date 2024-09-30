import { css } from '@emotion/css';
import classNames from 'classnames';
import { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneGridLayout, VizPanel, sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { activateInActiveParents } from '../utils/utils';

import { DashboardGridItem } from './DashboardGridItem';
import { DashboardScene } from './DashboardScene';

export interface Props {
  dashboard: DashboardScene;
  panelSearch?: string;
  panelsPerRow?: number;
}

const panelsPerRowCSSVar = '--panels-per-row';

export function PanelSearchLayout({ dashboard, panelSearch = '', panelsPerRow }: Props) {
  const { body } = dashboard.state;
  const panels: VizPanel[] = [];
  const styles = useStyles2(getStyles);

  if (!(body instanceof SceneGridLayout)) {
    return <Trans i18nKey="panel-search.unsupported-layout">Unsupported layout</Trans>;
  }

  for (const gridItem of body.state.children) {
    if (gridItem instanceof DashboardGridItem) {
      const panel = gridItem.state.body;
      const interpolatedTitle = sceneGraph.interpolate(dashboard, panel.state.title).toLowerCase();
      const interpolatedSearchString = sceneGraph.interpolate(dashboard, panelSearch).toLowerCase();
      if (interpolatedTitle.includes(interpolatedSearchString)) {
        panels.push(gridItem.state.body);
      }
    }
  }

  return (
    <div
      className={classNames(styles.grid, { [styles.perRow]: panelsPerRow !== undefined })}
      style={{ [panelsPerRowCSSVar]: panelsPerRow } as Record<string, number>}
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

function getStyles(theme: GrafanaTheme2) {
  return {
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      gap: theme.spacing(1),
      gridAutoRows: '320px',
    }),
    perRow: css({
      gridTemplateColumns: `repeat(var(${panelsPerRowCSSVar}, 3), 1fr)`,
    }),
  };
}
