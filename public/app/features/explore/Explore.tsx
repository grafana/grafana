import { css, cx } from '@emotion/css';
import React, { createRef } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import { compose } from 'redux';
import { Unsubscribable } from 'rxjs';

import {
  AbsoluteTimeRange,
  DataQuery,
  GrafanaTheme2,
  LoadingState,
  RawTimeRange,
  ExploreGraphStyle,
  ExploreId,
  QueryFixAction,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { CustomScrollbar, ErrorBoundaryAlert, Themeable2, withTheme2, PanelContainer } from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, FilterItem } from '@grafana/ui/src/components/Table/types';
import appEvents from 'app/core/app_events';
import { supportedFeatures } from 'app/core/history/richHistoryStorageProvider';
import { StoreState } from 'app/types';
import { AbsoluteTimeEvent } from 'app/types/events';
import { ExploreItemState } from 'app/types/explore';

import { getTimeZone } from '../profile/state/selectors';

import ExploreQueryInspector from './ExploreQueryInspector';
import { ExploreToolbar } from './ExploreToolbar';
import { NoData } from './NoData';
import { NoDataSourceCallToAction } from './NoDataSourceCallToAction';
import { Panel } from './Panel';
import { QueryRows } from './QueryRows';
import { ResponseErrorContainer } from './ResponseErrorContainer';
import RichHistoryContainer from './RichHistory/RichHistoryContainer';
import { SecondaryActions } from './SecondaryActions';
import { changeSize, changeGraphStyle } from './state/explorePane';
import { splitOpen } from './state/main';
import { addQueryRow, modifyQueries, scanStart, scanStopAction, setQueries } from './state/query';
import { makeAbsoluteTime, updateTimeRange } from './state/time';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    exploreMain: css`
      label: exploreMain;
      // Is needed for some transition animations to work.
      position: relative;
      margin-top: 21px;
    `,
    button: css`
      label: button;
      margin: 1em 4px 0 0;
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
  };
};

export interface ExploreProps extends Themeable2 {
  exploreId: ExploreId;
  theme: GrafanaTheme2;
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

  constructor(props: Props) {
    super(props);
    this.state = {
      openDrawer: undefined,
    };
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

  onCellFilterAdded = (filter: FilterItem) => {
    const { value, key, operator } = filter;
    if (operator === FILTER_FOR_OPERATOR) {
      this.onClickFilterLabel(key, value);
    }

    if (operator === FILTER_OUT_OPERATOR) {
      this.onClickFilterOutLabel(key, value);
    }
  };

  onClickFilterLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER', options: { key, value } });
  };

  onClickFilterOutLabel = (key: string, value: string) => {
    this.onModifyQueries({ type: 'ADD_FILTER_OUT', options: { key, value } });
  };

  onClickAddQueryRowButton = () => {
    const { exploreId, queryKeys, datasourceInstance } = this.props;
    this.props.addQueryRow(exploreId, queryKeys.length, datasourceInstance);
  };

  onMakeAbsoluteTime = () => {
    const { makeAbsoluteTime } = this.props;
    makeAbsoluteTime();
  };

  onModifyQueries = (action: QueryFixAction, index?: number) => {
    const { datasourceInstance } = this.props;
    if (datasourceInstance?.modifyQuery) {
      const modifier = (queries: DataQuery, modification: QueryFixAction) =>
        datasourceInstance.modifyQuery!(queries, modification);
      this.props.modifyQueries(this.props.exploreId, action, modifier, index);
    }
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

  onChangeGraphStyle = (graphStyle: ExploreGraphStyle) => {
    const { exploreId, changeGraphStyle } = this.props;
    changeGraphStyle(exploreId, graphStyle);
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

  renderPanels(width: number) {
    const { queryResponse, frames } = this.props;

    const showNoData =
      queryResponse.state === LoadingState.Done && Object.values(frames).every((frame) => frame.length === 0);

    if (showNoData) {
      return <ErrorBoundaryAlert>{this.renderNoData()}</ErrorBoundaryAlert>;
    }

    const panels: React.ReactNode[] = [];
    if (!frames) {
      return panels;
    }

    for (const key of Object.keys(frames)) {
      panels.push(
        <ErrorBoundaryAlert key={key}>
          <Panel
            onChangeGraphStyle={this.onChangeGraphStyle}
            data={frames[key]}
            absoluteRange={this.props.absoluteRange}
            range={this.props.range}
            timeZone={this.props.timeZone}
            splitOpen={this.props.splitOpen}
            annotations={this.props.queryResponse.annotations}
            loadingState={this.props.queryResponse.state}
            loading={this.props.loading}
            theme={this.props.theme}
            graphStyle={this.props.graphStyle}
            onUpdateTimeRange={this.onUpdateTimeRange}
            width={width}
            onCellFilterAdded={this.onCellFilterAdded}
            exploreId={this.props.exploreId}
            syncedTimes={this.props.syncedTimes}
            onClickFilterLabel={this.onClickFilterLabel}
            onClickFilterOutLabel={this.onClickFilterOutLabel}
            onStartScanning={this.onStartScanning}
            onStopScanning={this.onStopScanning}
            datasourceInstance={this.props.datasourceInstance}
            withTraceView={Boolean(frames['trace']?.length)}
            scrollElement={this.scrollElement}
            topOfViewRef={this.topOfViewRef}
            preferredVisualizationType={key}
            eventBus={this.props.eventBridge}
          />
        </ErrorBoundaryAlert>
      );
    }
    return panels;
  }

  render() {
    const { datasourceInstance, datasourceMissing, exploreId, queryResponse, isLive, theme, timeZone } = this.props;
    const { openDrawer } = this.state;
    const styles = getStyles(theme);
    const showPanels = queryResponse && queryResponse.state !== LoadingState.NotStarted;
    const showRichHistory = openDrawer === ExploreDrawer.RichHistory;
    const richHistoryRowButtonHidden = !supportedFeatures().queryHistoryAvailable;
    const showQueryInspector = openDrawer === ExploreDrawer.QueryInspector;

    return (
      <CustomScrollbar
        testId={selectors.pages.Explore.General.scrollView}
        autoHeightMin={'100%'}
        scrollRefCallback={(scrollElement) => (this.scrollElement = scrollElement || undefined)}
      >
        <ExploreToolbar exploreId={exploreId} onChangeTime={this.onChangeTime} topOfViewRef={this.topOfViewRef} />
        {datasourceMissing ? this.renderEmptyState(styles.exploreContainer) : null}
        {datasourceInstance && (
          <div className={cx(styles.exploreContainer)}>
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
                      {showPanels && this.renderPanels(width)}
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
        )}
      </CustomScrollbar>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: ExploreProps) {
  const explore = state.explore;
  const { syncedTimes } = explore;
  const item: ExploreItemState = explore[exploreId]!;
  const timeZone = getTimeZone(state.user);
  const {
    datasourceInstance,
    datasourceMissing,
    queryKeys,
    isLive,
    logsResult,
    absoluteRange,
    queryResponse,
    loading,
    graphStyle,
    frames,
    range,
    eventBridge,
  } = item;

  return {
    datasourceInstance,
    datasourceMissing,
    queryKeys,
    isLive,
    logsResult: logsResult ?? undefined,
    absoluteRange,
    queryResponse,
    syncedTimes,
    timeZone,
    loading,
    graphStyle,
    frames,
    range,
    eventBridge,
  };
}

const mapDispatchToProps = {
  changeSize,
  changeGraphStyle,
  modifyQueries,
  scanStart,
  scanStopAction,
  setQueries,
  updateTimeRange,
  makeAbsoluteTime,
  addQueryRow,
  splitOpen,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default compose(connector, withTheme2)(Explore) as React.ComponentType<{ exploreId: ExploreId }>;
