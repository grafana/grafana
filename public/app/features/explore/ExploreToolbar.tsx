import omitBy from 'lodash/omitBy';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import memoizeOne from 'memoize-one';
import classNames from 'classnames';
import { css } from 'emotion';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { ToggleButtonGroup, ToggleButton, Tooltip, ButtonSelect, SetInterval } from '@grafana/ui';
import { RawTimeRange, TimeZone, TimeRange, DataQuery, ExploreMode } from '@grafana/data';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { StoreState } from 'app/types/store';
import {
  changeDatasource,
  clearQueries,
  splitClose,
  runQueries,
  splitOpen,
  syncTimes,
  changeRefreshInterval,
  changeMode,
} from './state/actions';
import { updateLocation } from 'app/core/actions';
import { getTimeZone } from '../profile/state/selectors';
import { getDashboardSrv } from '../dashboard/services/DashboardSrv';
import kbn from '../../core/utils/kbn';
import { ExploreTimeControls } from './ExploreTimeControls';
import { LiveTailButton } from './LiveTailButton';
import { ResponsiveButton } from './ResponsiveButton';
import { RunButton } from './RunButton';
import { LiveTailControls } from './useLiveTailControls';
import { getExploreDatasources } from './state/selectors';
import { setDashboardQueriesToUpdateOnLoad } from '../dashboard/state/reducers';

const getStyles = memoizeOne(() => {
  return {
    liveTailButtons: css`
      margin-left: 10px;
      @media (max-width: 1110px) {
        margin-left: 4px;
      }
    `,
  };
});

interface OwnProps {
  exploreId: ExploreId;
  onChangeTime: (range: RawTimeRange, changedByScanner?: boolean) => void;
}

interface StateProps {
  datasourceMissing: boolean;
  loading: boolean;
  range: TimeRange;
  timeZone: TimeZone;
  splitted: boolean;
  syncedTimes: boolean;
  refreshInterval?: string;
  supportedModes: ExploreMode[];
  selectedMode: ExploreMode;
  hasLiveOption: boolean;
  isLive: boolean;
  isPaused: boolean;
  originPanelId?: number;
  queries: DataQuery[];
  datasourceLoading?: boolean;
  containerWidth: number;
  datasourceName?: string;
}

interface DispatchProps {
  changeDatasource: typeof changeDatasource;
  clearAll: typeof clearQueries;
  runQueries: typeof runQueries;
  closeSplit: typeof splitClose;
  split: typeof splitOpen;
  syncTimes: typeof syncTimes;
  changeRefreshInterval: typeof changeRefreshInterval;
  changeMode: typeof changeMode;
  updateLocation: typeof updateLocation;
  setDashboardQueriesToUpdateOnLoad: typeof setDashboardQueriesToUpdateOnLoad;
}

type Props = StateProps & DispatchProps & OwnProps;

export class UnConnectedExploreToolbar extends PureComponent<Props> {
  onChangeDatasource = async (option: { value: any }) => {
    this.props.changeDatasource(this.props.exploreId, option.value);
  };

  onClearAll = () => {
    this.props.clearAll(this.props.exploreId);
  };

  onRunQuery = () => {
    return this.props.runQueries(this.props.exploreId);
  };

  onChangeRefreshInterval = (item: string) => {
    const { changeRefreshInterval, exploreId } = this.props;
    changeRefreshInterval(exploreId, item);
  };

  onModeChange = (mode: ExploreMode) => {
    const { changeMode, exploreId } = this.props;
    changeMode(exploreId, mode);
  };

  onChangeTimeSync = () => {
    const { syncTimes, exploreId } = this.props;
    syncTimes(exploreId);
  };

  returnToPanel = async ({ withChanges = false } = {}) => {
    const { originPanelId, queries } = this.props;

    const dashboardSrv = getDashboardSrv();
    const dash = dashboardSrv.getCurrent();
    const titleSlug = kbn.slugifyForUrl(dash.title);

    if (withChanges) {
      this.props.setDashboardQueriesToUpdateOnLoad({
        panelId: originPanelId,
        queries: this.cleanQueries(queries),
      });
    }

    const dashViewOptions = {
      fullscreen: withChanges || dash.meta.fullscreen,
      edit: withChanges || dash.meta.isEditing,
    };

    this.props.updateLocation({
      path: `/d/${dash.uid}/:${titleSlug}`,
      query: {
        ...omitBy(dashViewOptions, v => !v),
        panelId: originPanelId,
      },
    });
  };

  // Remove explore specific parameters from queries
  private cleanQueries(queries: DataQuery[]) {
    return queries.map((query: DataQuery & { context?: string }) => {
      delete query.context;
      delete query.key;
      return query;
    });
  }

  getSelectedDatasource = () => {
    const { datasourceName } = this.props;
    const exploreDatasources = getExploreDatasources();
    return datasourceName ? exploreDatasources.find(datasource => datasource.name === datasourceName) : undefined;
  };

  render() {
    const {
      datasourceMissing,
      closeSplit,
      exploreId,
      loading,
      range,
      timeZone,
      splitted,
      syncedTimes,
      refreshInterval,
      onChangeTime,
      split,
      supportedModes,
      selectedMode,
      hasLiveOption,
      isLive,
      isPaused,
      originPanelId,
      datasourceLoading,
      containerWidth,
    } = this.props;

    const styles = getStyles();
    const originDashboardIsEditable = originPanelId && Number.isInteger(originPanelId);
    const panelReturnClasses = classNames('btn', 'navbar-button', {
      'btn--radius-right-0': originDashboardIsEditable,
      'navbar-button navbar-button--border-right-0': originDashboardIsEditable,
    });

    const showSmallDataSourcePicker = (splitted ? containerWidth < 700 : containerWidth < 800) || false;
    const showSmallTimePicker = splitted || containerWidth < 1210;

    return (
      <div className={splitted ? 'explore-toolbar splitted' : 'explore-toolbar'}>
        <div className="explore-toolbar-item">
          <div className="explore-toolbar-header">
            <div className="explore-toolbar-header-title">
              {exploreId === 'left' && (
                <span className="navbar-page-btn">
                  <i className="gicon gicon-explore" />
                  Explore
                </span>
              )}
            </div>
            {splitted && (
              <a className="explore-toolbar-header-close" onClick={() => closeSplit(exploreId)}>
                <i className="fa fa-times fa-fw" />
              </a>
            )}
          </div>
        </div>
        <div className="explore-toolbar-item">
          <div className="explore-toolbar-content">
            {!datasourceMissing ? (
              <div className="explore-toolbar-content-item">
                <div
                  className={classNames(
                    'explore-ds-picker',
                    showSmallDataSourcePicker ? 'explore-ds-picker--small' : ''
                  )}
                >
                  <DataSourcePicker
                    onChange={this.onChangeDatasource}
                    datasources={getExploreDatasources()}
                    current={this.getSelectedDatasource()}
                    showLoading={datasourceLoading}
                    hideTextValue={showSmallDataSourcePicker}
                  />
                </div>
                {supportedModes.length > 1 ? (
                  <div className="query-type-toggle">
                    <ToggleButtonGroup label="" transparent={true}>
                      <ToggleButton
                        key={ExploreMode.Metrics}
                        value={ExploreMode.Metrics}
                        onChange={this.onModeChange}
                        selected={selectedMode === ExploreMode.Metrics}
                      >
                        {'Metrics'}
                      </ToggleButton>
                      <ToggleButton
                        key={ExploreMode.Logs}
                        value={ExploreMode.Logs}
                        onChange={this.onModeChange}
                        selected={selectedMode === ExploreMode.Logs}
                      >
                        {'Logs'}
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </div>
                ) : null}
              </div>
            ) : null}

            {originPanelId && Number.isInteger(originPanelId) && !splitted && (
              <div className="explore-toolbar-content-item">
                <Tooltip content={'Return to panel'} placement="bottom">
                  <button className={panelReturnClasses} onClick={() => this.returnToPanel()}>
                    <i className="fa fa-arrow-left" />
                  </button>
                </Tooltip>
                {originDashboardIsEditable && (
                  <ButtonSelect
                    className="navbar-button--attached btn--radius-left-0$"
                    options={[{ label: 'Return to panel with changes', value: '' }]}
                    onChange={() => this.returnToPanel({ withChanges: true })}
                    maxMenuHeight={380}
                  />
                )}
              </div>
            )}

            {exploreId === 'left' && !splitted ? (
              <div className="explore-toolbar-content-item explore-icon-align">
                <ResponsiveButton
                  splitted={splitted}
                  title="Split"
                  onClick={split}
                  iconClassName="fa fa-fw fa-columns icon-margin-right"
                  disabled={isLive}
                />
              </div>
            ) : null}
            {!isLive && (
              <div className="explore-toolbar-content-item">
                <ExploreTimeControls
                  exploreId={exploreId}
                  range={range}
                  timeZone={timeZone}
                  onChangeTime={onChangeTime}
                  splitted={splitted}
                  syncedTimes={syncedTimes}
                  onChangeTimeSync={this.onChangeTimeSync}
                  hideText={showSmallTimePicker}
                />
              </div>
            )}

            {!isLive && (
              <div className="explore-toolbar-content-item explore-icon-align">
                <ResponsiveButton
                  splitted={splitted}
                  title="Clear All"
                  onClick={this.onClearAll}
                  iconClassName="fa fa-fw fa-trash icon-margin-right"
                />
              </div>
            )}
            <div className="explore-toolbar-content-item">
              <RunButton
                refreshInterval={refreshInterval}
                onChangeRefreshInterval={this.onChangeRefreshInterval}
                splitted={splitted}
                loading={loading || (isLive && !isPaused)}
                onRun={this.onRunQuery}
                showDropdown={!isLive}
              />
              {refreshInterval && <SetInterval func={this.onRunQuery} interval={refreshInterval} loading={loading} />}
            </div>

            {hasLiveOption && (
              <div className={`explore-toolbar-content-item ${styles.liveTailButtons}`}>
                <LiveTailControls exploreId={exploreId}>
                  {controls => (
                    <LiveTailButton
                      splitted={splitted}
                      isLive={isLive}
                      isPaused={isPaused}
                      start={controls.start}
                      pause={controls.pause}
                      resume={controls.resume}
                      stop={controls.stop}
                    />
                  )}
                </LiveTailControls>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState, { exploreId }: OwnProps): StateProps => {
  const splitted = state.explore.split;
  const syncedTimes = state.explore.syncedTimes;
  const exploreItem: ExploreItemState = state.explore[exploreId];
  const {
    datasourceInstance,
    datasourceMissing,
    range,
    refreshInterval,
    loading,
    supportedModes,
    mode,
    isLive,
    isPaused,
    originPanelId,
    queries,
    datasourceLoading,
    containerWidth,
  } = exploreItem;

  const hasLiveOption = datasourceInstance?.meta?.streaming && mode === ExploreMode.Logs;

  return {
    datasourceMissing,
    datasourceName: datasourceInstance?.name,
    loading,
    range,
    timeZone: getTimeZone(state.user),
    splitted,
    refreshInterval,
    supportedModes,
    selectedMode: supportedModes.includes(mode) ? mode : supportedModes[0],
    hasLiveOption,
    isLive,
    isPaused,
    originPanelId,
    queries,
    syncedTimes,
    datasourceLoading,
    containerWidth,
  };
};

const mapDispatchToProps: DispatchProps = {
  changeDatasource,
  updateLocation,
  changeRefreshInterval,
  clearAll: clearQueries,
  runQueries,
  closeSplit: splitClose,
  split: splitOpen,
  syncTimes,
  changeMode: changeMode,
  setDashboardQueriesToUpdateOnLoad,
};

export const ExploreToolbar = hot(module)(connect(mapStateToProps, mapDispatchToProps)(UnConnectedExploreToolbar));
