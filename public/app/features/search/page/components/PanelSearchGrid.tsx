import { css } from '@emotion/css';
import React, { useRef } from 'react';
import { useAsync } from 'react-use';
import { FixedSizeGrid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneFlexLayout, SceneTimeRange } from '@grafana/scenes';
import { useStyles2, Spinner } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { PanelModel } from 'app/features/dashboard/state';
import { createVizPanelFromPanelModel } from 'app/features/scenes/dashboard/DashboardsLoader';
import { TextMode } from 'app/plugins/panel/text/panelcfg.gen';
import { DashboardDTO } from 'app/types';

import { useSearchKeyboardNavigation } from '../../hooks/useSearchKeyboardSelection';
import { DashboardQueryResult } from '../../service';

import { SearchResultsProps } from './SearchResultsTable';

export const PanelSearchGrid = ({
  response,
  width,
  height,
  selection,
  selectionToggle,
  onTagSelected,
  onClickItem,
  keyboardEvents,
}: SearchResultsProps) => {
  const styles = useStyles2(getStyles);
  const loader = useRef(new PanelModelLoader());

  const itemCount = response.totalRows ?? response.view.length;
  const view = response.view;
  const numColumns = Math.ceil(width / 600);
  const cellWidth = width / numColumns;
  const cellHeight = (cellWidth - 64) * 0.7 + 56 + 8;
  const numRows = Math.ceil(itemCount / numColumns);
  const highlightIndex = useSearchKeyboardNavigation(keyboardEvents, numColumns, response);

  return (
    <InfiniteLoader isItemLoaded={response.isItemLoaded} itemCount={itemCount} loadMoreItems={response.loadMoreItems}>
      {({ onItemsRendered, ref }) => (
        <FixedSizeGrid
          ref={ref}
          onItemsRendered={(v) => {
            onItemsRendered({
              visibleStartIndex: v.visibleRowStartIndex * numColumns,
              visibleStopIndex: v.visibleRowStopIndex * numColumns,
              overscanStartIndex: v.overscanRowStartIndex * numColumns,
              overscanStopIndex: v.overscanColumnStopIndex * numColumns,
            });
          }}
          columnCount={numColumns}
          columnWidth={cellWidth}
          rowCount={numRows}
          rowHeight={cellHeight}
          className={styles.wrapper}
          innerElementType="ul"
          height={height}
          width={width - 2}
        >
          {({ columnIndex, rowIndex, style }) => {
            const index = rowIndex * numColumns + columnIndex;
            if (index >= view.length) {
              return null;
            }
            const item = { ...view.get(index) }; // spread avoidds issue with dynamic views
            let className = styles.virtualizedGridItemWrapper;
            if (rowIndex === highlightIndex.y && columnIndex === highlightIndex.x) {
              className += ' ' + styles.selectedItem;
            }

            // The wrapper div is needed as the inner SearchItem has margin-bottom spacing
            // And without this wrapper there is no room for that margin
            return (
              <div style={style} className={className}>
                {item.kind === 'panel' ? (
                  <PanelView width={cellWidth} height={cellHeight} item={item} loader={loader.current} />
                ) : (
                  <div>
                    TODO: show: {item.kind}/{item.uid}
                  </div>
                )}
              </div>
            );
          }}
        </FixedSizeGrid>
      )}
    </InfiniteLoader>
  );
};

interface PanelViewProps {
  width: number;
  height: number;
  item: DashboardQueryResult;
  loader: PanelModelLoader;
}

const PanelView = ({ width, height, item, loader }: PanelViewProps) => {
  const viz = useAsync(async () => {
    console.log('LOADING', item.uid);
    const m = await loader.findPanel(item);
    const v = createVizPanelFromPanelModel(m);

    new SceneFlexLayout({
      children: [v],
      $timeRange: loader.$timeRange, // shared time range
    }); // lost reference?

    return v;
  }, [width, height, item.uid, loader]);

  if (viz.error) {
    console.log('ERROR', { ...item }, viz.error);
    return (
      <div>
        Error loading: {item.uid} {viz.error && JSON.stringify(viz.error)}
      </div>
    );
  }

  if (viz.value) {
    return <viz.value.Component model={viz.value} />;
  }

  if (viz.loading) {
    return (
      <div>
        <Spinner />
        {item.name}
      </div>
    );
  }

  return <div>TODO!! {item.kind}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  virtualizedGridItemWrapper: css`
    padding: 4px;
  `,
  wrapper: css`
    display: flex;
    flex-direction: column;

    > ul {
      list-style: none;
    }
  `,
  selectedItem: css`
    box-shadow: inset 1px 1px 3px 3px ${theme.colors.primary.border};
  `,
});

class PanelModelLoader {
  private counter = 0;
  private dashboards = new Map<string, DashboardDTO>();

  $timeRange = new SceneTimeRange();

  async getDashboard(uid: string): Promise<DashboardDTO> {
    let dash = this.dashboards.get(uid);
    if (dash) {
      return Promise.resolve(dash);
    }
    dash = await backendSrv.getDashboardByUid(uid);
    dash.meta.canEdit = false; // avoids popup
    dash.meta.canSave = false; // avoids popup
    dash.meta.fromScript = true; // avoids popup
    this.dashboards.set(uid, dash);
    return dash;
  }

  async findPanel(p: DashboardQueryResult): Promise<PanelModel> {
    if (!config.panels[p.panel_type]) {
      return this.getErrorPanel('Unknown panel type ' + p.panel_type, p);
    }

    const idx = p.uid.indexOf('#');
    if (idx < 2) {
      return this.getErrorPanel('expected # in the UID', p);
    }

    const dashuid = p.uid.substring(0, idx);
    const panelid = parseInt(p.uid.substring(idx + 1), 10);
    const dash = await this.getDashboard(dashuid);
    const found = dash?.dashboard?.panels?.find((p) => p.id === panelid);
    if (!found) {
      return this.getErrorPanel('Unable to find: ' + p.uid, p);
    }

    const links = [
      {
        title: 'View',
        url: p.url,
      },
    ];

    if (found.links && Array.isArray(found.links)) {
      for (const v of found.links) {
        links.push(v);
      }
    }

    return {
      ...found,
      id: this.counter++,
      key: p.uid,
      links,
    };
  }

  getErrorPanel(err: string, p: DashboardQueryResult): PanelModel {
    const v = {
      id: this.counter++,
      key: p.uid,
      title: `ERROR: ${p.name}`,
      type: 'text',
      options: {
        content: `ERROR:  ${err}`,
        mode: TextMode.Markdown,
      },
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
    };
    return v as unknown as PanelModel;
  }
}
