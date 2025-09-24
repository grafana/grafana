import { css } from '@emotion/css';
import classNames from 'classnames';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { VizPanel, sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { DashboardScene } from './DashboardScene';
import { SoloPanelContextProvider } from './SoloPanelContext';

export interface Props {
  dashboard: DashboardScene;
  panelSearch?: string;
  panelsPerRow?: number;
}

const panelsPerRowCSSVar = '--panels-per-row';

export function PanelSearchLayout({ dashboard, panelSearch = '', panelsPerRow }: Props) {
  const { body } = dashboard.state;
  const styles = useStyles2(getStyles);
  const soloPanelContext = useMemo(() => new SoloPanelContextValueWithSearchStringFilter(panelSearch), [panelSearch]);

  return (
    <div
      className={classNames(styles.grid, { [styles.perRow]: panelsPerRow !== undefined })}
      style={{ [panelsPerRowCSSVar]: panelsPerRow } as Record<string, number>}
    >
      <SoloPanelContextProvider value={soloPanelContext} singleMatch={false} dashboard={dashboard}>
        <body.Component model={body} />
      </SoloPanelContextProvider>
    </div>
  );
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

export class SoloPanelContextValueWithSearchStringFilter {
  public matchFound = false;

  public constructor(private searchQuery: string) {}

  public matches(panel: VizPanel): boolean {
    const interpolatedSearchString = sceneGraph.interpolate(panel, this.searchQuery).toLowerCase();
    const interpolatedTitle = panel.interpolate(panel.state.title, undefined, 'text').toLowerCase();

    const match = interpolatedTitle.includes(interpolatedSearchString);
    if (match) {
      this.matchFound = true;
    }

    return match;
  }
}
