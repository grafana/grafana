import React from 'react';

import { ExplorePanelProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Collapse } from '@grafana/ui';
// // TODO: probably needs to be exported from ui directly
import { FilterItem, FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/src/components/Table/types';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { ExploreGraph } from '../ExploreGraph';
import { ExploreGraphLabel } from '../ExploreGraphLabel';
import LogsContainer from '../LogsContainer';
import { NodeGraphContainer } from '../NodeGraphContainer';
import TableContainer from '../TableContainer';
import { TraceViewContainer } from '../TraceView/TraceViewContainer';

export async function getPanelForVisType(visType: string): Promise<React.ComponentType<ExplorePanelProps>> {
  // TODO this is not much dynamic at the moment but it's a start of creating a common interface

  switch (visType) {
    case 'graph': {
      return GraphPanel;
    }
    case 'table': {
      return TablePanel;
    }

    case 'nodeGraph': {
      return NodeGraphPanel;
    }

    case 'logs': {
      return LogsPanel;
    }

    case 'trace': {
      return TraceViewPanel;
    }
    default: {
      const panels = getAllPanelPluginMeta();
      for (const panel of panels) {
        const panelPlugin = await importPanelPlugin(panel.id);
        if (panelPlugin.meta.visualizationType?.includes(visType)) {
          // If there is explorePanel component use that.
          if (panelPlugin.explorePanel) {
            return panelPlugin.explorePanel;
          } else if (panelPlugin.panel) {
            return makePanelExploreCompatible(panelPlugin.panel!);
          } else {
            // TODO: not sure if this can reasonably happen
          }
        }
      }
      // Probably ok fallback but maybe it makes sense to throw or show some info message that we did not find anything
      // better.
      return TablePanel;
    }
  }
}

function GraphPanel(props: ExplorePanelProps) {
  const {
    data,
    absoluteRange,
    timeZone,
    splitOpen,
    loading,
    theme,
    graphStyle,
    onChangeGraphStyle,
    annotations,
    loadingState,
    onUpdateTimeRange,
    width,
  } = props;
  const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
  const label = <ExploreGraphLabel graphStyle={graphStyle} onChangeGraphStyle={onChangeGraphStyle} />;
  return (
    <Collapse label={label} loading={loading} isOpen>
      <ExploreGraph
        graphStyle={graphStyle}
        data={data}
        height={400}
        width={width - spacing}
        absoluteRange={absoluteRange}
        onChangeTime={onUpdateTimeRange}
        timeZone={timeZone}
        annotations={annotations}
        splitOpenFn={splitOpen}
        loadingState={loadingState}
      />
    </Collapse>
  );
}

function TablePanel(props: ExplorePanelProps) {
  const { timeZone, width, splitOpen, loading, onClickFilterLabel, onClickFilterOutLabel, data, range } = props;
  function onCellFilterAdded(filter: FilterItem) {
    const { value, key, operator } = filter;
    if (operator === FILTER_FOR_OPERATOR) {
      onClickFilterLabel(key, value);
    }

    if (operator === FILTER_OUT_OPERATOR) {
      onClickFilterOutLabel(key, value);
    }
  }
  return (
    <TableContainer
      data={data[0]}
      ariaLabel={selectors.pages.Explore.General.table}
      width={width}
      splitOpen={splitOpen}
      timeZone={timeZone}
      loading={!!loading}
      onCellFilterAdded={onCellFilterAdded}
      range={range}
    />
  );
}

function LogsPanel(props: ExplorePanelProps) {
  const {
    exploreId,
    syncedTimes,
    theme,
    loadingState,
    width,
    onClickFilterLabel,
    onClickFilterOutLabel,
    onStartScanning,
    onStopScanning,
  } = props;
  const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
  return (
    <LogsContainer
      exploreId={exploreId}
      loadingState={loadingState}
      syncedTimes={syncedTimes}
      width={width - spacing}
      onClickFilterLabel={onClickFilterLabel}
      onClickFilterOutLabel={onClickFilterOutLabel}
      onStartScanning={onStartScanning}
      onStopScanning={onStopScanning}
    />
  );
}

function NodeGraphPanel(props: ExplorePanelProps) {
  const { exploreId, withTraceView, datasourceInstance, data } = props;
  const datasourceType = datasourceInstance ? datasourceInstance?.type : 'unknown';

  return (
    <NodeGraphContainer
      dataFrames={data}
      exploreId={exploreId}
      withTraceView={withTraceView}
      datasourceType={datasourceType}
    />
  );
}

function TraceViewPanel(props: ExplorePanelProps) {
  const { splitOpen, exploreId, data, scrollElement, topOfViewRef } = props;

  return (
    <TraceViewContainer
      exploreId={exploreId}
      dataFrames={data}
      splitOpenFn={splitOpen}
      scrollElement={scrollElement}
      topOfViewRef={topOfViewRef}
    />
  );
}
