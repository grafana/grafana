import { css, cx } from '@emotion/css';
import { cloneDeep, get, groupBy } from 'lodash';
import memoizeOne from 'memoize-one';
import React, { createRef } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Unsubscribable } from 'rxjs';

import {
  AbsoluteTimeRange,
  DataFrame,
  EventBus,
  GrafanaTheme2,
  hasToggleableQueryFiltersSupport,
  LoadingState,
  QueryFixAction,
  RawTimeRange,
  SplitOpenOptions,
  SupplementaryQueryType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import {
  AdHocFilterItem,
  CustomScrollbar,
  ErrorBoundaryAlert,
  PanelContainer,
  Themeable2,
  withTheme2,
} from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/src/components/Table/types';
import appEvents from 'app/core/app_events';
import { supportedFeatures } from 'app/core/history/richHistoryStorageProvider';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { getNodeGraphDataFrames } from 'app/plugins/panel/nodeGraph/utils';
import { StoreState } from 'app/types';
import { AbsoluteTimeEvent } from 'app/types/events';

import { getTimeZone } from '../profile/state/selectors';

import { CustomContainer } from './CustomContainer';
import ExploreQueryInspector from './ExploreQueryInspector';
import { ExploreToolbar } from './ExploreToolbar';
import { FlameGraphExploreContainer } from './FlameGraph/FlameGraphExploreContainer';
import { GraphContainer } from './Graph/GraphContainer';
import { MegaSelectContainer } from './Graph/MegaSelectContainer';
import LogsContainer from './Logs/LogsContainer';
import { LogsSamplePanel } from './Logs/LogsSamplePanel';
import { NoData } from './NoData';
import { NoDataSourceCallToAction } from './NoDataSourceCallToAction';
import { NodeGraphContainer } from './NodeGraph/NodeGraphContainer';
import { QueryRows } from './QueryRows';
import RawPrometheusContainer from './RawPrometheus/RawPrometheusContainer';
import { ResponseErrorContainer } from './ResponseErrorContainer';
import RichHistoryContainer from './RichHistory/RichHistoryContainer';
import { SecondaryActions } from './SecondaryActions';
import TableContainer from './Table/TableContainer';
import { TraceViewContainer } from './TraceView/TraceViewContainer';
import { changeSize } from './state/explorePane';
import { splitOpen } from './state/main';
import {
  addQueryRow,
  modifyQueries,
  scanStart,
  scanStopAction,
  selectIsWaitingForData,
  setQueries,
  setSupplementaryQueryEnabled,
} from './state/query';
import { isSplit } from './state/selectors';
import { makeAbsoluteTime, updateTimeRange } from './state/time';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    exploreMain: css`
      label: exploreMain;
      // Is needed for some transition animations to work.
      position: relative;
      margin-top: 21px;
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
    `,
    queryContainer: css`
      label: queryContainer;
      // Need to override normal css class and don't want to count on ordering of the classes in html.
      height: auto !important;
      flex: unset !important;
      display: unset !important;
      padding: ${theme.spacing(1)};
    `,
    exploreContainer: css`
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      padding: ${theme.spacing(2)};
      padding-top: 0;
    `,
    megaSelectStickyWrapper: css`
      position: sticky;
      top: 2px;
      left: 0;
      z-index: 1;
    `,
    megaSelectWrapper: css`
      position: relative;
    `,
    megaSelectSubWrapper: css`
      display: flex;
      flex-wrap: wrap;
    `,
    megaSelectItem: css``,
  };
};

export interface ExploreProps extends Themeable2 {
  exploreId: string;
  theme: GrafanaTheme2;
  eventBus: EventBus;
}

enum ExploreDrawer {
  RichHistory,
  QueryInspector,
}

interface ExploreState {
  openDrawer?: ExploreDrawer;
}

export type Props = ExploreProps & ConnectedProps<typeof connector>;

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
export class Explore extends React.PureComponent<Props, ExploreState> {
  scrollElement: HTMLDivElement | undefined;
  absoluteTimeUnsubsciber: Unsubscribable | undefined;
  topOfViewRef = createRef<HTMLDivElement>();
  graphEventBus: EventBus;
  logsEventBus: EventBus;

  constructor(props: Props) {
    super(props);
    this.state = {
      openDrawer: undefined,
    };
    this.graphEventBus = props.eventBus.newScopedBus('graph', { onlyLocal: false });
    this.logsEventBus = props.eventBus.newScopedBus('logs', { onlyLocal: false });
  }

  componentDidMount() {
    this.absoluteTimeUnsubsciber = appEvents.subscribe(AbsoluteTimeEvent, this.onMakeAbsoluteTime);
  }

  componentWillUnmount() {
    this.absoluteTimeUnsubsciber?.unsubscribe();
  }

  onChangeTime = (rawRange: RawTimeRange) => {
    const { updateTimeRange, exploreId } = this.props;
    updateTimeRange({ exploreId, rawRange });
  };

  // Use this in help pages to set page to a single query
  onClickExample = (query: DataQuery) => {
    this.props.setQueries(this.props.exploreId, [query]);
  };

  onCellFilterAdded = (filter: AdHocFilterItem) => {
    const { value, key, operator } = filter;
    if (operator === FILTER_FOR_OPERATOR) {
      this.onClickFilterLabel(key, value);
    }

    if (operator === FILTER_OUT_OPERATOR) {
      this.onClickFilterOutLabel(key, value);
    }
  };

  /**
   * Used by Logs details.
   * Returns true if all queries have the filter, otherwise false.
   * TODO: In the future, we would like to return active filters based the query that produced the log line.
   * @alpha
   */
  isFilterLabelActive = async (key: string, value: string) => {
    if (!config.featureToggles.toggleLabelsInLogsUI) {
      return false;
    }
    if (this.props.queries.length === 0) {
      return false;
    }
    for (const query of this.props.queries) {
      const ds = await getDataSourceSrv().get(query.datasource);
      if (!hasToggleableQueryFiltersSupport(ds)) {
        return false;
      }
      if (!ds.queryHasFilter(query, { key, value })) {
        return false;
      }
    }
    return true;
  };

  /**
   * Used by Logs details.
   */
  onClickFilterLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER', options: { key, value } });
  };

  /**
   * Used by Logs details.
   */
  onClickFilterOutLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER_OUT', options: { key, value } });
  };

  onClickAddQueryRowButton = () => {
    const { exploreId, queryKeys } = this.props;
    this.props.addQueryRow(exploreId, queryKeys.length);
  };

  onMakeAbsoluteTime = () => {
    const { makeAbsoluteTime } = this.props;
    makeAbsoluteTime();
  };

  /**
   * Used by Logs details.
   */
  onModifyQueries = (action: QueryFixAction) => {
    const modifier = async (query: DataQuery, modification: QueryFixAction) => {
      const { datasource } = query;
      if (datasource == null) {
        return query;
      }
      const ds = await getDataSourceSrv().get(datasource);
      if (hasToggleableQueryFiltersSupport(ds) && config.featureToggles.toggleLabelsInLogsUI) {
        return ds.toggleQueryFilter(query, {
          type: modification.type === 'ADD_FILTER' ? 'FILTER_FOR' : 'FILTER_OUT',
          options: modification.options ?? {},
        });
      }
      if (ds.modifyQuery) {
        return ds.modifyQuery(query, modification);
      } else {
        return query;
      }
    };
    this.props.modifyQueries(this.props.exploreId, action, modifier);
  };

  onResize = (size: { height: number; width: number }) => {
    this.props.changeSize(this.props.exploreId, size);
  };

  onStartScanning = () => {
    // Scanner will trigger a query
    this.props.scanStart(this.props.exploreId);
  };

  onStopScanning = () => {
    this.props.scanStopAction({ exploreId: this.props.exploreId });
  };

  onUpdateTimeRange = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;
    updateTimeRange({ exploreId, absoluteRange });
  };

  toggleShowRichHistory = () => {
    this.setState((state) => {
      return {
        openDrawer: state.openDrawer === ExploreDrawer.RichHistory ? undefined : ExploreDrawer.RichHistory,
      };
    });
  };

  toggleShowQueryInspector = () => {
    this.setState((state) => {
      return {
        openDrawer: state.openDrawer === ExploreDrawer.QueryInspector ? undefined : ExploreDrawer.QueryInspector,
      };
    });
  };

  onSplitOpen = (panelType: string) => {
    return async (options?: SplitOpenOptions) => {
      this.props.splitOpen(options);
      if (options && this.props.datasourceInstance) {
        const target = (await getDataSourceSrv().get(options.datasourceUid)).type;
        const source =
          this.props.datasourceInstance.uid === MIXED_DATASOURCE_NAME
            ? get(this.props.queries, '0.datasource.type')
            : this.props.datasourceInstance.type;
        const tracking = {
          origin: 'panel',
          panelType,
          source,
          target,
          exploreId: this.props.exploreId,
        };
        reportInteraction('grafana_explore_split_view_opened', tracking);
      }
    };
  };

  renderEmptyState(exploreContainerStyles: string) {
    return (
      <div className={cx(exploreContainerStyles)}>
        <NoDataSourceCallToAction />
      </div>
    );
  }

  renderNoData() {
    return <NoData />;
  }

  renderCustom(width: number) {
    const { timeZone, queryResponse, absoluteRange, eventBus } = this.props;

    const groupedByPlugin = groupBy(queryResponse?.customFrames, 'meta.preferredVisualisationPluginId');

    return Object.entries(groupedByPlugin).map(([pluginId, frames], index) => {
      return (
        <CustomContainer
          key={index}
          timeZone={timeZone}
          pluginId={pluginId}
          frames={frames}
          state={queryResponse.state}
          absoluteRange={absoluteRange}
          height={400}
          width={width}
          splitOpenFn={this.onSplitOpen(pluginId)}
          eventBus={eventBus}
        />
      );
    });
  }

  renderGraphPanel(width: number) {
    const { graphResult, absoluteRange, timeZone, queryResponse, showFlameGraph } = this.props;

    return (
      <GraphContainer
        data={graphResult!}
        height={showFlameGraph ? 180 : 400}
        width={width}
        absoluteRange={absoluteRange}
        timeZone={timeZone}
        onChangeTime={this.onUpdateTimeRange}
        annotations={queryResponse.annotations}
        splitOpenFn={this.onSplitOpen('graph')}
        loadingState={queryResponse.state}
        eventBus={this.graphEventBus}
      />
    );
  }

  renderMegaSelectPanels(width: number, megaSelectView: string, megaSelectEndpoint: string) {
    const { graphResult, absoluteRange, timeZone, queryResponse, theme, exemplarsHack } = this.props;
    const styles = getStyles(theme);

    //@todo not this
    const graphResultClone: DataFrame[] = JSON.parse(JSON.stringify(graphResult));

    const filterExemplars = (exemplars: DataFrame[], targetFrame: DataFrame): DataFrame[] => {
      console.log('exemplars', exemplars);
      console.log('targetFrame', targetFrame);
      const result = exemplars.map((exemplar) => {
        let newExemplar: DataFrame;
        newExemplar = cloneDeep(exemplar);
        newExemplar.fields.forEach((field) => (field.values = []));

        const frameLabels = targetFrame.fields[1].labels;

        if (frameLabels) {
          // Iterate through the labels from the dataFrame for this panel
          Object.keys(frameLabels).forEach((labelName) => {
            const labelValue = frameLabels[labelName];

            // Find the field that has this name
            const targetField = exemplar.fields.find((field) => field.name === labelName);

            if (targetField) {
              // Iterate through all of the values for this field, each one that matches the value for the selected frame is an exemplar that is relevant, copy all values of the dataframe with this index, into the new dataframe
              for (let i = 0; i < targetField.values.length; i++) {
                if (targetField.values.get(i) === labelValue) {
                  exemplar.fields.forEach((field, fieldIndex) => {
                    newExemplar.fields[fieldIndex].values.add(field.values.get(i));
                  });
                }
              }
            }
          });
        }

        newExemplar.length = newExemplar.fields[0].values.length;
        return newExemplar;
      });
      console.log('filtered Exemplars', result);
      return result;
    };

    //@todo just grabbing first timeseries as megaSelect for now
    const megaSummaryIndex = graphResultClone.findIndex((df) => df.name === 'mega-summary');
    const getMegaSelect = graphResultClone.splice(megaSummaryIndex, 1)[0];

    // Filter the number of panels to render
    const panelsToRender = graphResultClone.slice(0, 20);

    if (getMegaSelect && getMegaSelect.fields?.length) {
      getMegaSelect.length = getMegaSelect.fields[0].values.length;
    }

    console.log('queryresponse.annotations', queryResponse.annotations);
    console.log('dataframes', graphResult);

    return (
      <div className={styles.megaSelectWrapper}>
        <div className={styles.megaSelectStickyWrapper}>
          <MegaSelectContainer
            options={{
              view: megaSelectView,
              endpoint: megaSelectEndpoint,
              mega: true,
            }}
            data={[getMegaSelect]}
            height={300}
            width={width}
            absoluteRange={absoluteRange}
            timeZone={timeZone}
            onChangeTime={this.onUpdateTimeRange}
            annotations={filterExemplars(queryResponse.annotations ?? [], getMegaSelect)}
            splitOpenFn={this.onSplitOpen('graph')}
            loadingState={queryResponse.state}
            eventBus={this.graphEventBus}
          />
        </div>
        <div className={styles.megaSelectSubWrapper}>
          {panelsToRender &&
            panelsToRender.map((frame) => (
              <div key={JSON.stringify(frame.fields[1].labels)} className={styles.megaSelectItem}>
                <MegaSelectContainer
                  actionsOverride={<></>}
                  data={[frame]}
                  height={250}
                  width={width / 4}
                  absoluteRange={absoluteRange}
                  timeZone={timeZone}
                  onChangeTime={this.onUpdateTimeRange}
                  annotations={filterExemplars(exemplarsHack ? [exemplarsHack] : [], frame)}
                  splitOpenFn={this.onSplitOpen('graph')}
                  loadingState={queryResponse.state}
                  eventBus={this.graphEventBus}
                  options={{
                    view: megaSelectView,
                    endpoint: megaSelectEndpoint,
                    mega: false,
                  }}
                />
              </div>
            ))}
        </div>
      </div>
    );
  }

  renderTablePanel(width: number) {
    const { exploreId, timeZone } = this.props;
    return (
      <TableContainer
        ariaLabel={selectors.pages.Explore.General.table}
        width={width}
        exploreId={exploreId}
        onCellFilterAdded={this.onCellFilterAdded}
        timeZone={timeZone}
        splitOpenFn={this.onSplitOpen('table')}
      />
    );
  }

  renderRawPrometheus(width: number) {
    const { exploreId, datasourceInstance, timeZone } = this.props;
    return (
      <RawPrometheusContainer
        showRawPrometheus={true}
        ariaLabel={selectors.pages.Explore.General.table}
        width={width}
        exploreId={exploreId}
        onCellFilterAdded={datasourceInstance?.modifyQuery ? this.onCellFilterAdded : undefined}
        timeZone={timeZone}
        splitOpenFn={this.onSplitOpen('table')}
      />
    );
  }

  renderLogsPanel(width: number) {
    const { exploreId, syncedTimes, theme, queryResponse } = this.props;
    const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
    return (
      <LogsContainer
        exploreId={exploreId}
        loadingState={queryResponse.state}
        syncedTimes={syncedTimes}
        width={width - spacing}
        onClickFilterLabel={this.onClickFilterLabel}
        onClickFilterOutLabel={this.onClickFilterOutLabel}
        onStartScanning={this.onStartScanning}
        onStopScanning={this.onStopScanning}
        eventBus={this.logsEventBus}
        splitOpenFn={this.onSplitOpen('logs')}
        scrollElement={this.scrollElement}
        isFilterLabelActive={this.isFilterLabelActive}
      />
    );
  }

  renderLogsSamplePanel() {
    const { logsSample, timeZone, setSupplementaryQueryEnabled, exploreId, datasourceInstance, queries } = this.props;

    return (
      <LogsSamplePanel
        queryResponse={logsSample.data}
        timeZone={timeZone}
        enabled={logsSample.enabled}
        queries={queries}
        datasourceInstance={datasourceInstance}
        splitOpen={this.onSplitOpen('logsSample')}
        setLogsSampleEnabled={(enabled: boolean) =>
          setSupplementaryQueryEnabled(exploreId, enabled, SupplementaryQueryType.LogsSample)
        }
      />
    );
  }

  renderNodeGraphPanel() {
    const { exploreId, showTrace, queryResponse, datasourceInstance } = this.props;
    const datasourceType = datasourceInstance ? datasourceInstance?.type : 'unknown';

    return (
      <NodeGraphContainer
        dataFrames={this.memoizedGetNodeGraphDataFrames(queryResponse.series)}
        exploreId={exploreId}
        withTraceView={showTrace}
        datasourceType={datasourceType}
        splitOpenFn={this.onSplitOpen('nodeGraph')}
      />
    );
  }

  memoizedGetNodeGraphDataFrames = memoizeOne(getNodeGraphDataFrames);

  renderFlameGraphPanel() {
    const { queryResponse } = this.props;
    return <FlameGraphExploreContainer dataFrames={queryResponse.flameGraphFrames} />;
  }

  renderTraceViewPanel() {
    const { queryResponse, exploreId } = this.props;
    const dataFrames = queryResponse.series.filter((series) => series.meta?.preferredVisualisationType === 'trace');

    return (
      // If there is no data (like 404) we show a separate error so no need to show anything here
      dataFrames.length && (
        <TraceViewContainer
          exploreId={exploreId}
          dataFrames={dataFrames}
          splitOpenFn={this.onSplitOpen('traceView')}
          scrollElement={this.scrollElement}
          queryResponse={queryResponse}
          topOfViewRef={this.topOfViewRef}
        />
      )
    );
  }

  render() {
    const {
      datasourceInstance,
      exploreId,
      graphResult,
      queryResponse,
      isLive,
      theme,
      showMetrics,
      showTable,
      showRawPrometheus,
      showLogs,
      showTrace,
      showCustom,
      showNodeGraph,
      showFlameGraph,
      timeZone,
      showLogsSample,
      showMegaSelect,
      megaSelectView,
      megaSelectEndpoint,
    } = this.props;
    const { openDrawer } = this.state;
    const styles = getStyles(theme);
    const showPanels = queryResponse && queryResponse.state !== LoadingState.NotStarted;
    const showRichHistory = openDrawer === ExploreDrawer.RichHistory;
    const richHistoryRowButtonHidden = !supportedFeatures().queryHistoryAvailable;
    const showQueryInspector = openDrawer === ExploreDrawer.QueryInspector;
    const showNoData =
      queryResponse.state === LoadingState.Done &&
      [
        queryResponse.logsFrames,
        queryResponse.graphFrames,
        queryResponse.nodeGraphFrames,
        queryResponse.flameGraphFrames,
        queryResponse.tableFrames,
        queryResponse.rawPrometheusFrames,
        queryResponse.traceFrames,
        queryResponse.customFrames,
      ].every((e) => e.length === 0);

    return (
      <CustomScrollbar
        testId={selectors.pages.Explore.General.scrollView}
        autoHeightMin={'100%'}
        scrollRefCallback={(scrollElement) => (this.scrollElement = scrollElement || undefined)}
      >
        <ExploreToolbar exploreId={exploreId} onChangeTime={this.onChangeTime} topOfViewRef={this.topOfViewRef} />
        {datasourceInstance ? (
          <div className={styles.exploreContainer}>
            <PanelContainer className={styles.queryContainer}>
              <QueryRows exploreId={exploreId} />
              <SecondaryActions
                addQueryRowButtonDisabled={isLive}
                // We cannot show multiple traces at the same time right now so we do not show add query button.
                //TODO:unification
                addQueryRowButtonHidden={false}
                richHistoryRowButtonHidden={richHistoryRowButtonHidden}
                richHistoryButtonActive={showRichHistory}
                queryInspectorButtonActive={showQueryInspector}
                onClickAddQueryRowButton={this.onClickAddQueryRowButton}
                onClickRichHistoryButton={this.toggleShowRichHistory}
                onClickQueryInspectorButton={this.toggleShowQueryInspector}
              />
              <ResponseErrorContainer exploreId={exploreId} />
            </PanelContainer>
            <AutoSizer onResize={this.onResize} disableHeight>
              {({ width }) => {
                if (width === 0) {
                  return null;
                }

                return (
                  <main className={cx(styles.exploreMain)} style={{ width }}>
                    <ErrorBoundaryAlert>
                      {showPanels && (
                        <>
                          {!showMegaSelect && showMetrics && graphResult && (
                            <ErrorBoundaryAlert>{this.renderGraphPanel(width)}</ErrorBoundaryAlert>
                          )}
                          {showRawPrometheus && (
                            <ErrorBoundaryAlert>{this.renderRawPrometheus(width)}</ErrorBoundaryAlert>
                          )}
                          {showTable && !showMegaSelect && (
                            <ErrorBoundaryAlert>{this.renderTablePanel(width)}</ErrorBoundaryAlert>
                          )}
                          {showLogs && <ErrorBoundaryAlert>{this.renderLogsPanel(width)}</ErrorBoundaryAlert>}
                          {showNodeGraph && <ErrorBoundaryAlert>{this.renderNodeGraphPanel()}</ErrorBoundaryAlert>}
                          {showFlameGraph && <ErrorBoundaryAlert>{this.renderFlameGraphPanel()}</ErrorBoundaryAlert>}
                          {showTrace && <ErrorBoundaryAlert>{this.renderTraceViewPanel()}</ErrorBoundaryAlert>}
                          {showLogsSample && <ErrorBoundaryAlert>{this.renderLogsSamplePanel()}</ErrorBoundaryAlert>}
                          {showMegaSelect && graphResult && (
                            <ErrorBoundaryAlert>
                              {this.renderMegaSelectPanels(width, megaSelectView, megaSelectEndpoint)}
                            </ErrorBoundaryAlert>
                          )}
                          {showCustom && <ErrorBoundaryAlert>{this.renderCustom(width)}</ErrorBoundaryAlert>}
                          {showNoData && <ErrorBoundaryAlert>{this.renderNoData()}</ErrorBoundaryAlert>}
                        </>
                      )}
                      {showRichHistory && (
                        <RichHistoryContainer
                          width={width}
                          exploreId={exploreId}
                          onClose={this.toggleShowRichHistory}
                        />
                      )}
                      {showQueryInspector && (
                        <ExploreQueryInspector
                          exploreId={exploreId}
                          width={width}
                          onClose={this.toggleShowQueryInspector}
                          timeZone={timeZone}
                        />
                      )}
                    </ErrorBoundaryAlert>
                  </main>
                );
              }}
            </AutoSizer>
          </div>
        ) : (
          this.renderEmptyState(styles.exploreContainer)
        )}
      </CustomScrollbar>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: ExploreProps) {
  const explore = state.explore;
  const { syncedTimes } = explore;
  const item = explore.panes[exploreId]!;

  const timeZone = getTimeZone(state.user);
  const {
    datasourceInstance,
    queryKeys,
    queries,
    isLive,
    graphResult,
    tableResult,
    logsResult,
    showLogs,
    showMetrics,
    showTable,
    showTrace,
    showCustom,
    absoluteRange,
    queryResponse,
    showNodeGraph,
    showFlameGraph,
    showRawPrometheus,
    supplementaryQueries,
  } = item;

  const loading = selectIsWaitingForData(exploreId)(state);
  const logsSample = supplementaryQueries[SupplementaryQueryType.LogsSample];
  // We want to show logs sample only if there are no log results and if there is already graph or table result
  const showLogsSample = !!(logsSample.dataProvider !== undefined && !logsResult && (graphResult || tableResult));
  const showMegaSelect = item.queries.some((query) => query.queryType === 'megaSelect');
  const exemplarsHack = item.queryResponse.series?.find((series) => series.name === 'exemplar');

  const query = item.queries.find((query) => query?.queryType === 'megaSelect');
  //@ts-ignore
  const megaSelectView = query?.view ?? '';
  //@ts-ignore
  const megaSelectEndpoint = query?.megaSpan?.replace('http://', '') ?? '';

  return {
    datasourceInstance,
    queryKeys,
    queries,
    isLive,
    graphResult,
    logsResult: logsResult ?? undefined,
    absoluteRange,
    queryResponse,
    syncedTimes,
    timeZone,
    showLogs,
    showMetrics,
    showTable,
    showTrace,
    showCustom,
    showNodeGraph,
    showRawPrometheus,
    showFlameGraph,
    splitted: isSplit(state),
    loading,
    logsSample,
    showLogsSample,
    showMegaSelect,
    megaSelectView,
    megaSelectEndpoint,
    exemplarsHack,
  };
}

const mapDispatchToProps = {
  changeSize,
  modifyQueries,
  scanStart,
  scanStopAction,
  setQueries,
  updateTimeRange,
  makeAbsoluteTime,
  addQueryRow,
  splitOpen,
  setSupplementaryQueryEnabled,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default withTheme2(connector(Explore));
