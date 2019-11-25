// Libraries
import React, { ComponentType } from 'react';
import { hot } from 'react-hot-loader';
import { css } from 'emotion';
import { AutoSizer } from 'react-virtualized';
import memoizeOne from 'memoize-one';
// Services & Utils
import store from 'app/core/store';
// Components
import { ErrorBoundaryAlert } from '@grafana/ui';
import LogsContainer from './LogsContainer';
import QueryRows from './QueryRows';
import TableContainer from './TableContainer';
// Actions
import {
  changeSize,
  initializeExplore,
  modifyQueries,
  refreshExplore,
  scanStart,
  setQueries,
  toggleGraph,
  updateTimeRange,
} from './state/actions';
// Types
import {
  AbsoluteTimeRange,
  DataQuery,
  DataSourceApi,
  ExploreStartPageProps,
  GraphSeriesXY,
  PanelData,
  RawTimeRange,
  TimeZone,
} from '@grafana/data';

import {
  ExploreId,
  ExploreItemState,
  ExploreMode,
  ExploreUIState,
  ExploreUpdateState,
  ExploreUrlState,
} from 'app/types/explore';
import { StoreState } from 'app/types';
import {
  DEFAULT_RANGE,
  DEFAULT_UI_STATE,
  ensureQueries,
  getTimeRangeFromUrl,
  lastUsedDatasourceKeyForOrgId,
} from 'app/core/utils/explore';
import { Emitter } from 'app/core/utils/emitter';
import { ExploreToolbar } from './ExploreToolbar';
import { NoDataSourceCallToAction } from './NoDataSourceCallToAction';
import { getTimeZone } from '../profile/state/selectors';
import { ErrorContainer } from './ErrorContainer';
import { scanStopAction } from './state/actionTypes';
import { ExploreGraphPanel } from './ExploreGraphPanel';
import { ReduxComponent } from '../../core/components/ReduxComponent/ReduxComponent';

const getStyles = memoizeOne(() => {
  return {
    logsMain: css`
      label: logsMain;
      // Is needed for some transition animations to work.
      position: relative;
    `,
  };
});

interface ExploreProps {
  exploreId: ExploreId;
}

interface ExploreState {}

export interface ReduxState {
  StartPage?: ComponentType<ExploreStartPageProps>;
  datasourceInstance: DataSourceApi;
  datasourceMissing: boolean;
  initialized: boolean;
  update: ExploreUpdateState;
  scanning?: boolean;
  scanRange?: RawTimeRange;
  split: boolean;
  showingStartPage?: boolean;
  queryKeys: string[];
  initialDatasource: string;
  initialQueries: DataQuery[];
  initialRange: RawTimeRange;
  mode: ExploreMode;
  initialUI: ExploreUIState;
  isLive: boolean;
  syncedTimes: boolean;
  graphResult?: GraphSeriesXY[];
  loading?: boolean;
  absoluteRange: AbsoluteTimeRange;
  showingGraph?: boolean;
  showingTable?: boolean;
  timeZone?: TimeZone;
  onHiddenSeriesChanged?: (hiddenSeries: string[]) => void;
  queryResponse: PanelData;
  originPanelId: number;
}

export interface ReduxActions {
  changeSize: typeof changeSize;
  initializeExplore: typeof initializeExplore;
  modifyQueries: typeof modifyQueries;
  refreshExplore: typeof refreshExplore;
  scanStart: typeof scanStart;
  scanStopAction: typeof scanStopAction;
  setQueries: typeof setQueries;
  updateTimeRange: typeof updateTimeRange;
  toggleGraph: typeof toggleGraph;
}

/**
 * Explore provides an area for quick query iteration for a given datasource.
 * Once a datasource is selected it populates the query section at the top.
 * When queries are run, their results are being displayed in the main section.
 * The datasource determines what kind of query editor it brings, and what kind
 * of results viewers it supports. The state is managed entirely in Redux.
 *
 * SPLIT VIEW
 *
 * Explore can have two Explore areas side-by-side. This is handled in `Wrapper.tsx`.
 * Since there can be multiple Explores (e.g., left and right) each action needs
 * the `exploreId` as first parameter so that the reducer knows which Explore state
 * is affected.
 *
 * DATASOURCE REQUESTS
 *
 * A click on Run Query creates transactions for all DataQueries for all expanded
 * result viewers. New runs are discarding previous runs. Upon completion a transaction
 * saves the result. The result viewers construct their data from the currently existing
 * transactions.
 *
 * The result viewers determine some of the query options sent to the datasource, e.g.,
 * `format`, to indicate eventual transformations by the datasources' result transformers.
 */
export class Explore extends ReduxComponent<ExploreProps, ExploreState, ReduxState, ReduxActions> {
  el: any;
  exploreEvents: Emitter;

  constructor(props: ExploreProps) {
    super(props);

    this.exploreEvents = new Emitter();
  }

  stateSelector(state: StoreState): ReduxState {
    const explore = state.explore;
    const { split, syncedTimes } = explore;
    const item: ExploreItemState = explore[this.props.exploreId];
    const timeZone = getTimeZone(state.user);
    const {
      StartPage,
      datasourceInstance,
      datasourceMissing,
      initialized,
      showingStartPage,
      queryKeys,
      urlState,
      update,
      isLive,
      supportedModes,
      mode,
      graphResult,
      loading,
      showingGraph,
      showingTable,
      absoluteRange,
      queryResponse,
    } = item;

    const { datasource, queries, range: urlRange, mode: urlMode, ui, originPanelId } = (urlState ||
      {}) as ExploreUrlState;
    const initialDatasource = datasource || store.get(lastUsedDatasourceKeyForOrgId(state.user.orgId));
    const initialQueries: DataQuery[] = ensureQueriesMemoized(queries);
    const initialRange = urlRange ? getTimeRangeFromUrlMemoized(urlRange, timeZone).raw : DEFAULT_RANGE;

    let newMode: ExploreMode;

    if (supportedModes.length) {
      const urlModeIsValid = supportedModes.includes(urlMode);
      const modeStateIsValid = supportedModes.includes(mode);

      if (modeStateIsValid) {
        newMode = mode;
      } else if (urlModeIsValid) {
        newMode = urlMode;
      } else {
        newMode = supportedModes[0];
      }
    } else {
      newMode = [ExploreMode.Metrics, ExploreMode.Logs].includes(urlMode) ? urlMode : null;
    }

    const initialUI = ui || DEFAULT_UI_STATE;

    return {
      StartPage,
      datasourceInstance,
      datasourceMissing,
      initialized,
      showingStartPage,
      split,
      queryKeys,
      update,
      initialDatasource,
      initialQueries,
      initialRange,
      mode: newMode,
      initialUI,
      isLive,
      graphResult,
      loading,
      showingGraph,
      showingTable,
      absoluteRange,
      queryResponse,
      originPanelId,
      syncedTimes,
    };
  }

  actionsToDispatch(): ReduxActions {
    return {
      changeSize,
      initializeExplore,
      modifyQueries,
      refreshExplore: refreshExplore,
      scanStart,
      scanStopAction,
      setQueries,
      updateTimeRange,
      toggleGraph,
    };
  }

  componentDidMount() {
    const { exploreId } = this.props;
    const { initialized, initialDatasource, initialQueries, initialRange, mode, initialUI, originPanelId } = this.state;
    const width = this.el ? this.el.offsetWidth : 0;

    // initialize the whole explore first time we mount and if browser history contains a change in datasource
    if (!initialized) {
      this.actions.initializeExplore(
        exploreId,
        initialDatasource,
        initialQueries,
        initialRange,
        mode,
        width,
        this.exploreEvents,
        initialUI,
        originPanelId
      );
    }
  }

  componentWillUnmount() {
    this.exploreEvents.removeAllListeners();
  }

  componentDidUpdate(prevProps: ExploreProps) {
    this.refreshExplore();
  }

  getRef = (el: any) => {
    this.el = el;
  };

  onChangeTime = (rawRange: RawTimeRange) => {
    const { exploreId } = this.props;
    this.actions.updateTimeRange({ exploreId, rawRange });
  };

  // Use this in help pages to set page to a single query
  onClickExample = (query: DataQuery) => {
    this.actions.setQueries(this.props.exploreId, [query]);
  };

  onClickFilterLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER', key, value });
  };

  onClickFilterOutLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER_OUT', key, value });
  };

  onModifyQueries = (action: any, index?: number) => {
    const { datasourceInstance } = this.state;
    if (datasourceInstance && datasourceInstance.modifyQuery) {
      const modifier = (queries: DataQuery, modification: any) => datasourceInstance.modifyQuery(queries, modification);
      this.actions.modifyQueries(this.props.exploreId, action, index, modifier);
    }
  };

  onResize = (size: { height: number; width: number }) => {
    this.actions.changeSize(this.props.exploreId, size);
  };

  onStartScanning = () => {
    // Scanner will trigger a query
    this.actions.scanStart(this.props.exploreId);
  };

  onStopScanning = () => {
    this.actions.scanStopAction({ exploreId: this.props.exploreId });
  };

  onToggleGraph = (showingGraph: boolean) => {
    const { exploreId } = this.props;
    this.actions.toggleGraph(exploreId, showingGraph);
  };

  onUpdateTimeRange = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId } = this.props;
    this.actions.updateTimeRange({ exploreId, absoluteRange });
  };

  refreshExplore = () => {
    const { exploreId } = this.props;
    const { update } = this.state;

    if (update.queries || update.ui || update.range || update.datasource || update.mode) {
      this.actions.refreshExplore(exploreId);
    }
  };

  renderEmptyState = () => {
    return (
      <div className="explore-container">
        <NoDataSourceCallToAction />
      </div>
    );
  };

  render() {
    const { exploreId } = this.props;
    const {
      StartPage,
      datasourceInstance,
      datasourceMissing,
      showingStartPage,
      split,
      queryKeys,
      mode,
      graphResult,
      loading,
      absoluteRange,
      showingGraph,
      showingTable,
      timeZone,
      queryResponse,
      syncedTimes,
    } = this.state;
    const exploreClass = split ? 'explore explore-split' : 'explore';
    const styles = getStyles();

    return (
      <div className={exploreClass} ref={this.getRef}>
        <ExploreToolbar exploreId={exploreId} onChangeTime={this.onChangeTime} />
        {datasourceMissing ? this.renderEmptyState() : null}
        {datasourceInstance && (
          <div className="explore-container">
            <QueryRows exploreEvents={this.exploreEvents} exploreId={exploreId} queryKeys={queryKeys} />
            <ErrorContainer queryErrors={[queryResponse.error]} />
            <AutoSizer onResize={this.onResize} disableHeight>
              {({ width }) => {
                if (width === 0) {
                  return null;
                }

                return (
                  <main className={`m-t-2 ${styles.logsMain}`} style={{ width }}>
                    <ErrorBoundaryAlert>
                      {showingStartPage && (
                        <div className="grafana-info-box grafana-info-box--max-lg">
                          <StartPage
                            onClickExample={this.onClickExample}
                            datasource={datasourceInstance}
                            exploreMode={mode}
                          />
                        </div>
                      )}
                      {!showingStartPage && (
                        <>
                          {mode === ExploreMode.Metrics && (
                            <ExploreGraphPanel
                              series={graphResult}
                              width={width}
                              loading={loading}
                              absoluteRange={absoluteRange}
                              isStacked={false}
                              showPanel={true}
                              showingGraph={showingGraph}
                              showingTable={showingTable}
                              timeZone={timeZone}
                              onToggleGraph={this.onToggleGraph}
                              onUpdateTimeRange={this.onUpdateTimeRange}
                              showBars={false}
                              showLines={true}
                            />
                          )}
                          {mode === ExploreMode.Metrics && (
                            <TableContainer exploreId={exploreId} onClickCell={this.onClickFilterLabel} />
                          )}
                          {mode === ExploreMode.Logs && (
                            <LogsContainer
                              width={width}
                              exploreId={exploreId}
                              syncedTimes={syncedTimes}
                              onClickFilterLabel={this.onClickFilterLabel}
                              onClickFilterOutLabel={this.onClickFilterOutLabel}
                              onStartScanning={this.onStartScanning}
                              onStopScanning={this.onStopScanning}
                            />
                          )}
                        </>
                      )}
                    </ErrorBoundaryAlert>
                  </main>
                );
              }}
            </AutoSizer>
          </div>
        )}
      </div>
    );
  }
}

const ensureQueriesMemoized = memoizeOne(ensureQueries);
const getTimeRangeFromUrlMemoized = memoizeOne(getTimeRangeFromUrl);

export default hot(module)(Explore) as React.ComponentType<{ exploreId: ExploreId }>;
