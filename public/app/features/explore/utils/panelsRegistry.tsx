import React from 'react';

import { ExplorePanelProps, FieldConfigSource, PanelProps, ScopedVars } from '@grafana/data';
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

/**
 * Wrap panel adding a transform so we can use dashboard panels Explore without modification.
 * @param Panel
 */
function makePanelExploreCompatible(Panel: React.ComponentType<PanelProps>): React.ComponentType<ExplorePanelProps> {
  return function CompatibilityWrapper(props: ExplorePanelProps) {
    // This transform may not be 100% perfect so we may need to use some sensible zero/empty/noop values. We will have
    // to see how much impact that will have but I would think even if that makes some panels loose some functionality
    // it may be still ok. If there are bugs we will have to fix them somehow.
    const dashboardProps = transformToDashboardProps(props);
    return <Panel {...dashboardProps} />;
  };
}

function transformToDashboardProps(props: ExplorePanelProps): PanelProps {
  return {
    data: {
      series: props.data,
      annotations: props.annotations,
      state: props.loadingState,
      timeRange: props.range,
    },
    eventBus: props.eventBus,
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    height: 0,
    id: 0,
    onChangeTimeRange: props.onUpdateTimeRange,
    onFieldConfigChange(config: FieldConfigSource): void {
      return;
    },
    onOptionsChange<TOptions>(options: TOptions): void {
      return;
    },
    // importPanelPlugin returns PanelPlugin which is basically PanelPlugin<any> so we don't know what should be
    // here but there are no options to pass in Explore
    options: undefined,
    renderCounter: 0,
    replaceVariables(value: string, scopedVars: ScopedVars | undefined, format: string | Function | undefined): string {
      return value;
    },
    timeRange: props.range,
    timeZone: props.timeZone,
    title: 'explore-panel',
    transparent: false,
    width: props.width,
  };
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
