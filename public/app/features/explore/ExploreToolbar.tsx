import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import memoizeOne from 'memoize-one';
import classNames from 'classnames';
import { css } from 'emotion';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { Icon, IconButton, SetInterval, Tooltip } from '@grafana/ui';
import { DataSourceInstanceSettings, RawTimeRange, TimeRange, TimeZone } from '@grafana/data';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { StoreState } from 'app/types/store';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { changeDatasource } from './state/datasource';
import { splitClose, splitOpen } from './state/main';
import { syncTimes, changeRefreshInterval } from './state/time';
import { getTimeZone } from '../profile/state/selectors';
import { updateTimeZoneForSession } from '../profile/state/reducers';
import { ExploreTimeControls } from './ExploreTimeControls';
import { LiveTailButton } from './LiveTailButton';
import { ResponsiveButton } from './ResponsiveButton';
import { RunButton } from './RunButton';
import { LiveTailControls } from './useLiveTailControls';
import { cancelQueries, clearQueries, runQueries } from './state/query';
import ReturnToDashboardButton from './ReturnToDashboardButton';

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
  hasLiveOption: boolean;
  isLive: boolean;
  isPaused: boolean;
  datasourceLoading?: boolean | null;
  containerWidth: number;
  datasourceName?: string;
}

interface DispatchProps {
  changeDatasource: typeof changeDatasource;
  clearAll: typeof clearQueries;
  cancelQueries: typeof cancelQueries;
  runQueries: typeof runQueries;
  closeSplit: typeof splitClose;
  split: typeof splitOpen;
  syncTimes: typeof syncTimes;
  changeRefreshInterval: typeof changeRefreshInterval;
  onChangeTimeZone: typeof updateTimeZoneForSession;
}

type Props = StateProps & DispatchProps & OwnProps;

export class UnConnectedExploreToolbar extends PureComponent<Props> {
  onChangeDatasource = async (dsSettings: DataSourceInstanceSettings) => {
    this.props.changeDatasource(this.props.exploreId, dsSettings.name, { importQueries: true });
  };

  onClearAll = () => {
    this.props.clearAll(this.props.exploreId);
  };

  onRunQuery = (loading = false) => {
    if (loading) {
      return this.props.cancelQueries(this.props.exploreId);
    } else {
      return this.props.runQueries(this.props.exploreId);
    }
  };

  onChangeRefreshInterval = (item: string) => {
    const { changeRefreshInterval, exploreId } = this.props;
    changeRefreshInterval(exploreId, item);
  };

  onChangeTimeSync = () => {
    const { syncTimes, exploreId } = this.props;
    syncTimes(exploreId);
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
      hasLiveOption,
      isLive,
      isPaused,
      containerWidth,
      onChangeTimeZone,
    } = this.props;

    const styles = getStyles();
    const showSmallDataSourcePicker = (splitted ? containerWidth < 700 : containerWidth < 800) || false;
    const showSmallTimePicker = splitted || containerWidth < 1210;

    return (
      <div className={splitted ? 'explore-toolbar splitted' : 'explore-toolbar'}>
        <div className="explore-toolbar-item">
          <div className="explore-toolbar-header">
            <div className="explore-toolbar-header-title">
              {exploreId === 'left' && (
                <span className="navbar-page-btn">
                  <Icon
                    name="compass"
                    size="lg"
                    className={css`
                      margin-right: 6px;
                      margin-bottom: 3px;
                    `}
                  />
                  Explore
                </span>
              )}
            </div>
            {splitted && (
              <IconButton className="explore-toolbar-header-close" onClick={() => closeSplit(exploreId)} name="times" />
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
                    current={this.props.datasourceName}
                    hideTextValue={showSmallDataSourcePicker}
                  />
                </div>
              </div>
            ) : null}
            <ReturnToDashboardButton exploreId={exploreId} />
            {exploreId === 'left' && !splitted ? (
              <div className="explore-toolbar-content-item explore-icon-align">
                <ResponsiveButton
                  splitted={splitted}
                  title="Split"
                  /* This way ResponsiveButton doesn't add event as a parameter when invoking split function
                   * which breaks splitting functionality
                   */
                  onClick={() => split()}
                  icon="columns"
                  iconClassName="icon-margin-right"
                  disabled={isLive}
                />
              </div>
            ) : null}
            <div className={'explore-toolbar-content-item'}>
              <Tooltip content={'Copy shortened link'} placement="bottom">
                <button className={'btn navbar-button'} onClick={() => createAndCopyShortLink(window.location.href)}>
                  <Icon name="share-alt" />
                </button>
              </Tooltip>
            </div>
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
                  onChangeTimeZone={onChangeTimeZone}
                />
              </div>
            )}

            {!isLive && (
              <div className="explore-toolbar-content-item explore-icon-align">
                <ResponsiveButton
                  splitted={splitted}
                  title="Clear All"
                  onClick={this.onClearAll}
                  icon="trash-alt"
                  iconClassName="icon-margin-right"
                />
              </div>
            )}
            <div className="explore-toolbar-content-item">
              <RunButton
                refreshInterval={refreshInterval}
                onChangeRefreshInterval={this.onChangeRefreshInterval}
                splitted={splitted}
                isLive={isLive}
                loading={loading || (isLive && !isPaused)}
                onRun={this.onRunQuery}
                showDropdown={!isLive}
              />
              {refreshInterval && <SetInterval func={this.onRunQuery} interval={refreshInterval} loading={loading} />}
            </div>

            {hasLiveOption && (
              <div className={`explore-toolbar-content-item ${styles.liveTailButtons}`}>
                <LiveTailControls exploreId={exploreId}>
                  {(controls) => (
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
    isLive,
    isPaused,
    containerWidth,
  } = exploreItem;

  const hasLiveOption = !!datasourceInstance?.meta?.streaming;

  return {
    datasourceMissing,
    datasourceName: datasourceInstance?.name,
    loading,
    range,
    timeZone: getTimeZone(state.user),
    splitted,
    refreshInterval,
    hasLiveOption,
    isLive,
    isPaused,
    syncedTimes,
    containerWidth,
  };
};

const mapDispatchToProps: DispatchProps = {
  changeDatasource,
  changeRefreshInterval,
  clearAll: clearQueries,
  cancelQueries,
  runQueries,
  closeSplit: splitClose,
  split: splitOpen,
  syncTimes,
  onChangeTimeZone: updateTimeZoneForSession,
};

export const ExploreToolbar = hot(module)(connect(mapStateToProps, mapDispatchToProps)(UnConnectedExploreToolbar));
