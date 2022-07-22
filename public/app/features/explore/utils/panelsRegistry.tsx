import React, { RefObject } from 'react';

import {
  AbsoluteTimeRange,
  DataFrame,
  DataSourceApi,
  GrafanaTheme2,
  LoadingState,
  SplitOpen,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Collapse } from '@grafana/ui';
// // TODO: probably needs to be exported from ui directly
import { FilterItem, FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/src/components/Table/types';

import { ExploreGraphStyle, ExploreId } from '../../../types';
import { ExploreGraph } from '../ExploreGraph';
import { ExploreGraphLabel } from '../ExploreGraphLabel';
import LogsContainer from '../LogsContainer';
import { NodeGraphContainer } from '../NodeGraphContainer';
import TableContainer from '../TableContainer';
import { TraceViewContainer } from '../TraceView/TraceViewContainer';

export function getPanelForVisType(visType: string): React.ComponentType<Props> | undefined {
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
      // Probably ok but maybe it makes sense to throw or show some info message
      return TablePanel;
    }
  }
}

interface Props {
  onChangeGraphStyle: (style: ExploreGraphStyle) => void;
  data: DataFrame[];
  absoluteRange: AbsoluteTimeRange;
  range: TimeRange;
  timeZone: TimeZone;
  splitOpen: SplitOpen;
  annotations?: DataFrame[];
  loadingState: LoadingState;
  loading?: boolean;
  theme: GrafanaTheme2;
  graphStyle: ExploreGraphStyle;
  onUpdateTimeRange: (timeRange: AbsoluteTimeRange) => void;
  width: number;
  onCellFilterAdded: (filter: FilterItem) => void;
  exploreId: ExploreId;
  syncedTimes: boolean;
  onClickFilterLabel: (key: string, value: string) => void;
  onClickFilterOutLabel: (key: string, value: string) => void;
  onStartScanning: () => void;
  onStopScanning: () => void;
  datasourceInstance?: DataSourceApi | null;
  withTraceView?: boolean;
  scrollElement?: Element;
  topOfViewRef: RefObject<HTMLDivElement>;
}

function GraphPanel(props: Props) {
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

function TablePanel(props: Props) {
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

function LogsPanel(props: Props) {
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

function NodeGraphPanel(props: Props) {
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

function TraceViewPanel(props: Props) {
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
