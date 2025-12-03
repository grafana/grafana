/* eslint-disable */
/* tslint:disable:react-prefer-stateless-function */

import { css, cx } from '@emotion/css';
import { get } from 'lodash';
import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import {
  DataFrame,
  EventBus,
  getNextRefId,
  GrafanaTheme2,
  hasToggleableQueryFiltersSupport,
  QueryFixAction,
  RawTimeRange,
  SplitOpenOptions,
  store,
  SupplementaryQueryType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { AdHocFilterItem, PanelContainer, ScrollContainer, Themeable2, withTheme2 } from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/internal';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { StoreState } from 'app/types/store';

import { getTimeZone } from '../profile/state/selectors';

import { Blocks } from './Blocks';
import { CONTENT_OUTLINE_LOCAL_STORAGE_KEYS, ContentOutline } from './ContentOutline/ContentOutline';
import { ContentOutlineContextProvider } from './ContentOutline/ContentOutlineContext';
import { ContentOutlineItem } from './ContentOutline/ContentOutlineItem';
import { CorrelationHelper } from './CorrelationHelper';
import { ExploreToolbar } from './ExploreToolbar';
import { NoDataSourceCallToAction } from './NoDataSourceCallToAction';
import { RenderResults } from './RenderResults';
import { ResponseErrorContainer } from './ResponseErrorContainer';
import { AddQueryButtons } from './SecondaryActions';
import { changeDatasource } from './state/datasource';
import { changeCompactMode } from './state/explorePane';
import { splitOpen } from './state/main';
import { addQueryRow, modifyQueries, selectIsWaitingForData, setQueries } from './state/query';
import { isSplit, selectExploreDSMaps } from './state/selectors';
import { updateTimeRange } from './state/time';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    exploreMain: css({
      label: 'exploreMain',
      // Is needed for some transition animations to work.
      position: 'relative',
      marginTop: theme.spacing(3),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    queryContainer: css({
      label: 'queryContainer',
      padding: theme.spacing(1),
    }),
    exploreContainer: css({
      label: 'exploreContainer',
      display: 'flex',
      flexDirection: 'column',
      paddingRight: theme.spacing(2),
      marginBottom: theme.spacing(2),
    }),
    wrapper: css({
      position: 'absolute',
      top: 0,
      left: theme.spacing(2),
      right: 0,
      bottom: 0,
      display: 'flex',
    }),
  };
};

export interface ExploreProps extends Themeable2 {
  exploreId: string;
  theme: GrafanaTheme2;
  eventBus: EventBus;
  setShowQueryInspector: (value: boolean) => void;
  showQueryInspector: boolean;
}

interface ExploreState {
  contentOutlineVisible: boolean;
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

export class Explore extends PureComponent<Props, ExploreState> {
  scrollElement: HTMLDivElement | undefined;
  graphEventBus: EventBus;
  logsEventBus: EventBus;

  constructor(props: Props) {
    super(props);
    this.state = {
      contentOutlineVisible: store.getBool(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.visible, true),
    };
    this.graphEventBus = props.eventBus.newScopedBus('graph', { onlyLocal: false });
    this.logsEventBus = props.eventBus.newScopedBus('logs', { onlyLocal: false });
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

  onContentOutlineToogle = () => {
    store.set(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.visible, !this.state.contentOutlineVisible);
    this.setState((state) => {
      const newContentOutlineVisible = this.props.compact ? true : !state.contentOutlineVisible;
      reportInteraction('explore_toolbar_contentoutline_clicked', {
        item: 'outline',
        type: newContentOutlineVisible ? 'open' : 'close',
      });
      return {
        contentOutlineVisible: newContentOutlineVisible,
      };
    });
    this.props.changeCompactMode(this.props.exploreId, false);
  };

  /**
   * Used by Logs details.
   * Returns true if the query identified by `refId` has a filter with the provided key and value.
   * @alpha
   */
  isFilterLabelActive = async (key: string, value: string | number, refId?: string) => {
    const query = this.props.queries.find((q) => q.refId === refId);
    if (!query) {
      return false;
    }
    const ds = await getDataSourceSrv().get(query.datasource);
    if (hasToggleableQueryFiltersSupport(ds) && ds.queryHasFilter(query, { key, value: value.toString() })) {
      return true;
    }
    return false;
  };

  /**
   * Used by Logs details.
   */
  onClickFilterLabel = (key: string, value: string | number, frame?: DataFrame) => {
    this.onModifyQueries(
      {
        type: 'ADD_FILTER',
        options: { key, value: value.toString() },
        frame,
      },
      frame?.refId
    );
  };

  /**
   * Used by Logs details.
   */
  onClickFilterOutLabel = (key: string, value: string | number, frame?: DataFrame) => {
    this.onModifyQueries(
      {
        type: 'ADD_FILTER_OUT',
        options: { key, value: value.toString() },
        frame,
      },
      frame?.refId
    );
  };

  /**
   * Used by Logs Popover Menu.
   */
  onClickFilterString = (value: string | number, refId?: string) => {
    this.onModifyQueries({ type: 'ADD_STRING_FILTER', options: { value: value.toString() } }, refId);
  };

  /**
   * Used by Logs Popover Menu.
   */
  onClickFilterOutString = (value: string | number, refId?: string) => {
    this.onModifyQueries({ type: 'ADD_STRING_FILTER_OUT', options: { value: value.toString() } }, refId);
  };

  onClickAddQueryRowButton = () => {
    const { exploreId, queryKeys } = this.props;
    this.props.addQueryRow(exploreId, queryKeys.length);
  };

  /**
   * Used by Logs details.
   */
  onModifyQueries = (action: QueryFixAction, refId?: string) => {
    const modifier = async (query: DataQuery, modification: QueryFixAction) => {
      // This gives Logs Details support to modify the query that produced the log line.
      // If not present, all queries are modified.
      if (refId && refId !== query.refId) {
        return query;
      }
      const { datasource } = query;
      if (datasource == null) {
        return query;
      }
      const ds = await getDataSourceSrv().get(datasource);
      const toggleableFilters = ['ADD_FILTER', 'ADD_FILTER_OUT'];
      if (hasToggleableQueryFiltersSupport(ds) && toggleableFilters.includes(modification.type)) {
        return ds.toggleQueryFilter(query, {
          type: modification.type === 'ADD_FILTER' ? 'FILTER_FOR' : 'FILTER_OUT',
          options: modification.options ?? {},
          frame: modification.frame,
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

  /**
   * Used for interaction from the visualizations. Will open split view in compact mode.
   */
  onSplitOpen = (panelType: string) => {
    return async (options?: SplitOpenOptions) => {
      let compact = false;

      /**
       * Temporary fix grafana-clickhouse-datasource as it requires the query editor to be fully rendered to update the query
       * Proposed fixes:
       * - https://github.com/grafana/clickhouse-datasource/issues/1363 - handle query update in data source
       * - https://github.com/grafana/grafana/issues/110868 - allow data links to provide meta info if the link can be handled in compact mode (default to false)
       * Update:
       * More data source may struggle with this setting: https://github.com/grafana/grafana/issues/112075
       * We're making it enabled for tempo only and will try to make it optional for other data sources in the future.
       */
      const dsType = getDataSourceSrv().getInstanceSettings({ uid: options?.datasourceUid })?.type;
      if (dsType === 'tempo' || options?.queries?.every((q) => q.datasource?.type === 'tempo')) {
        compact = true;
      }

      this.props.splitOpen(options ? { ...options, compact } : options);
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

  onPinLineCallback = () => {
    this.setState({ contentOutlineVisible: true });
  };

  renderEmptyState(exploreContainerStyles: string) {
    return (
      <div className={cx(exploreContainerStyles)}>
        <NoDataSourceCallToAction />
      </div>
    );
  }

  render() {
    const {
      datasourceInstance,
      exploreId,
      isLive,
      theme,
      correlationEditorDetails,
      correlationEditorHelperData,
      compact,
      queryLibraryRef,
    } = this.props;
    const { contentOutlineVisible } = this.state;
    const styles = getStyles(theme);

    let correlationsBox = undefined;
    const isCorrelationsEditorMode = correlationEditorDetails?.editorMode;
    const showCorrelationHelper = Boolean(isCorrelationsEditorMode || correlationEditorDetails?.correlationDirty);
    if (showCorrelationHelper && correlationEditorHelperData !== undefined) {
      correlationsBox = <CorrelationHelper exploreId={exploreId} correlations={correlationEditorHelperData} />;
    }

    return (
      <ContentOutlineContextProvider refreshDependencies={this.props.queries}>
        <ExploreToolbar
          exploreId={exploreId}
          onChangeTime={this.onChangeTime}
          onContentOutlineToogle={this.onContentOutlineToogle}
          isContentOutlineOpen={contentOutlineVisible}
        />
        <div
          style={{
            position: 'relative',
            height: '100%',
            paddingLeft: theme.spacing(2),
          }}
        >
          <div className={styles.wrapper}>
            {contentOutlineVisible && !compact && (
              <ContentOutline scroller={this.scrollElement} panelId={`content-outline-container-${exploreId}`} />
            )}
            <ScrollContainer
              data-testid={selectors.pages.Explore.General.scrollView}
              ref={(scrollElement) => {
                this.scrollElement = scrollElement || undefined;
              }}
            >
              <div className={styles.exploreContainer}>
                {datasourceInstance ? (
                  <>
                    {correlationsBox}
                    <Blocks
                      exploreId={exploreId}
                      changeCompactMode={(compact: boolean) =>
                        this.props.changeCompactMode(this.props.exploreId, false)
                      }
                      onSplitOpen={this.onSplitOpen}
                      graphEventBus={this.graphEventBus}
                      logsEventBus={this.logsEventBus}
                      onCellFilterAdded={this.onCellFilterAdded}
                      onClickFilterLabel={this.onClickFilterLabel}
                      onClickFilterOutLabel={this.onClickFilterOutLabel}
                      onClickFilterString={this.onClickFilterString}
                      onClickFilterOutString={this.onClickFilterOutString}
                      isFilterLabelActive={this.isFilterLabelActive}
                      onPinLineCallback={this.onPinLineCallback}
                      scrollElement={this.scrollElement}
                    />
                    <ResponseErrorContainer exploreId={exploreId} />

                    <AddQueryButtons
                      exploreId={exploreId}
                      onClickAddQueryRowButton={this.onClickAddQueryRowButton}
                      // We cannot show multiple traces at the same time right now so we do not show add query button.
                      //TODO:unification
                      addQueryRowButtonHidden={false}
                      // do not allow people to add queries with potentially different datasources in correlations editor mode
                      addQueryRowButtonDisabled={
                        isLive || (isCorrelationsEditorMode && datasourceInstance.meta.mixed) || !!queryLibraryRef
                      }
                      onSelectQueryFromLibrary={async (query) => {
                        const { changeDatasource, queries, setQueries } = this.props;
                        const newQueries = [
                          ...queries,
                          {
                            ...query,
                            refId: getNextRefId(queries),
                          },
                        ];
                        setQueries(exploreId, newQueries);
                        if (query.datasource?.uid) {
                          const uniqueDatasources = new Set(newQueries.map((q) => q.datasource?.uid));
                          const isMixed = uniqueDatasources.size > 1;
                          const newDatasourceRef = {
                            uid: isMixed ? MIXED_DATASOURCE_NAME : query.datasource.uid,
                          };
                          const shouldChangeDatasource = datasourceInstance.uid !== newDatasourceRef.uid;
                          if (shouldChangeDatasource) {
                            await changeDatasource({ exploreId, datasource: newDatasourceRef });
                          }
                        }
                      }}
                    />
                  </>
                ) : (
                  this.renderEmptyState(styles.exploreContainer)
                )}
              </div>
            </ScrollContainer>
          </div>
        </div>
      </ContentOutlineContextProvider>
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
    queryResponse,
    showNodeGraph,
    showFlameGraph,
    showRawPrometheus,
    supplementaryQueries,
    correlationEditorHelperData,
    compact,
    queryLibraryRef,
  } = item;

  const loading = selectIsWaitingForData(exploreId)(state);
  const logsSample = supplementaryQueries[SupplementaryQueryType.LogsSample];
  // We want to show logs sample only if there are no log results and if there is already graph or table result
  const showLogsSample = !!(logsSample.dataProvider !== undefined && !logsResult && (graphResult || tableResult));

  return {
    datasourceInstance,
    queryKeys,
    queries,
    isLive,
    graphResult,
    logsResult: logsResult ?? undefined,
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
    compact,
    loading,
    logsSample,
    showLogsSample,
    correlationEditorHelperData,
    correlationEditorDetails: explore.correlationEditorDetails,
    exploreActiveDS: selectExploreDSMaps(state),
    queryLibraryRef,
  };
}

const mapDispatchToProps = {
  changeDatasource,
  modifyQueries,
  setQueries,
  addQueryRow,
  splitOpen,
  changeCompactMode,
  updateTimeRange,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default withTheme2(connector(Explore));
/* eslint-enable */
/* tslint:enable:react-prefer-stateless-function */
