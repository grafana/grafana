import { css } from '@emotion/css';
import classNames from 'classnames';
import { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneGridRow, VizPanel, sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { forceActivateFullSceneObjectTree } from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { DashboardRepeatsProcessedEvent } from './types/DashboardRepeatsProcessedEvent';

export interface Props {
  dashboard: DashboardScene;
  panelSearch?: string;
  panelsPerRow?: number;
}

const panelsPerRowCSSVar = '--panels-per-row';

export function PanelSearchLayout({ dashboard, panelSearch = '', panelsPerRow }: Props) {
  const { body } = dashboard.state;
  const filteredPanels: VizPanel[] = [];
  const styles = useStyles2(getStyles);
  const [_, setRepeatsUpdated] = useState('');

  const bodyGrid = body instanceof DefaultGridLayoutManager ? body.state.grid : null;

  if (!bodyGrid) {
    return <Trans i18nKey="panel-search.unsupported-layout">Unsupported layout</Trans>;
  }

  for (const gridItem of bodyGrid.state.children) {
    if (gridItem instanceof DashboardGridItem) {
      filterPanels(gridItem, dashboard, panelSearch, filteredPanels, setRepeatsUpdated);
    } else if (gridItem instanceof SceneGridRow) {
      for (const rowItem of gridItem.state.children) {
        if (rowItem instanceof DashboardGridItem) {
          filterPanels(rowItem, dashboard, panelSearch, filteredPanels, setRepeatsUpdated);
        }
      }
    }
  }

  if (filteredPanels.length > 0) {
    return (
      <div
        className={classNames(styles.grid, { [styles.perRow]: panelsPerRow !== undefined })}
        style={{ [panelsPerRowCSSVar]: panelsPerRow } as Record<string, number>}
      >
        {filteredPanels.map((panel) => (
          <PanelSearchHit key={panel.state.key} panel={panel} />
        ))}
      </div>
    );
  }

  return (
    <p className={styles.noHits}>
      <Trans i18nKey="panel-search.no-matches">No matches found</Trans>
    </p>
  );
}

function PanelSearchHit({ panel }: { panel: VizPanel }) {
  useEffect(() => {
    const deactivate = forceActivateFullSceneObjectTree(panel);

    return () => {
      deactivate?.();
    };
  }, [panel]);

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
    noHits: css({
      display: 'grid',
      placeItems: 'center',
    }),
  };
}

function filterPanels(
  gridItem: DashboardGridItem,
  dashboard: DashboardScene,
  searchString: string,
  filteredPanels: VizPanel[],
  setRepeatsUpdated: (updated: string) => void
) {
  const interpolatedSearchString = sceneGraph.interpolate(dashboard, searchString).toLowerCase();

  // activate inactive repeat panel if one of its children will be matched
  if (gridItem.state.variableName && !gridItem.isActive) {
    const panel = gridItem.state.body;
    const interpolatedTitle = panel.interpolate(panel.state.title, undefined, 'text').toLowerCase();
    if (interpolatedTitle.includes(interpolatedSearchString)) {
      gridItem.subscribeToEvent(DashboardRepeatsProcessedEvent, (event) => {
        const source = event.payload.source;
        if (source instanceof DashboardGridItem) {
          setRepeatsUpdated(event.payload.source.state.key ?? '');
        }
      });
      gridItem.activate();
    }
  }

  const panels = gridItem.state.repeatedPanels ?? [gridItem.state.body];
  for (const panel of panels) {
    const interpolatedTitle = panel.interpolate(panel.state.title, undefined, 'text').toLowerCase();
    if (interpolatedTitle.includes(interpolatedSearchString)) {
      filteredPanels.push(panel);
    }
  }

  return filteredPanels;
}
