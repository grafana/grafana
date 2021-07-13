import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { hot } from 'react-hot-loader';
import classNames from 'classnames';
import { css } from '@emotion/css';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { Icon, IconButton, SetInterval, ToolbarButton, ToolbarButtonRow, Tooltip } from '@grafana/ui';
import { DataSourceInstanceSettings, RawTimeRange } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { StoreState } from 'app/types/store';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { changeDatasource } from './state/datasource';
import { splitClose, splitOpen } from './state/main';
import { syncTimes, changeRefreshInterval } from './state/time';
import { getTimeZone } from '../profile/state/selectors';
import { updateTimeZoneForSession } from '../profile/state/reducers';
import { ExploreTimeControls } from './ExploreTimeControls';
import { LiveTailButton } from './LiveTailButton';
import { RunButton } from './RunButton';
import { LiveTailControls } from './useLiveTailControls';
import { cancelQueries, clearQueries, runQueries, clearCache } from './state/query';
import ReturnToDashboardButton from './ReturnToDashboardButton';
import { isSplit } from './state/selectors';

interface OwnProps {
  exploreId: ExploreId;
  onChangeTime: (range: RawTimeRange, changedByScanner?: boolean) => void;
}

type Props = OwnProps & ConnectedProps<typeof connector>;

export class UnConnectedExploreToolbar extends PureComponent<Props> {
  onChangeDatasource = async (dsSettings: DataSourceInstanceSettings) => {
    this.props.changeDatasource(this.props.exploreId, dsSettings.name, { importQueries: true });
  };

  onClearAll = () => {
    this.props.clearAll(this.props.exploreId);
  };

  onRunQuery = (loading = false) => {
    const { clearCache, runQueries, cancelQueries, exploreId } = this.props;
    if (loading) {
      return cancelQueries(exploreId);
    } else {
      // We want to give user a chance tu re-run the query even if it is saved in cache
      clearCache(exploreId);
      return runQueries(exploreId);
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
              <IconButton
                title="Close split pane"
                className="explore-toolbar-header-close"
                onClick={() => closeSplit(exploreId)}
                name="times"
              />
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
            <ToolbarButtonRow>
              <ReturnToDashboardButton exploreId={exploreId} />

              {exploreId === 'left' && !splitted ? (
                <ToolbarButton
                  iconOnly={splitted}
                  title="Split"
                  /* This way ToolbarButton doesn't add event as a parameter when invoking split function
                   * which breaks splitting functionality
                   */
                  onClick={() => split()}
                  icon="columns"
                  disabled={isLive}
                >
                  Split
                </ToolbarButton>
              ) : null}

              <Tooltip content={'Copy shortened link to the executed query'} placement="bottom">
                <ToolbarButton icon="share-alt" onClick={() => createAndCopyShortLink(window.location.href)} />
              </Tooltip>

              {!isLive && (
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
              )}

              {!isLive && (
                <ToolbarButton title="Clear all" onClick={this.onClearAll} icon="trash-alt" iconOnly={splitted}>
                  Clear all
                </ToolbarButton>
              )}

              <RunButton
                refreshInterval={refreshInterval}
                onChangeRefreshInterval={this.onChangeRefreshInterval}
                isSmall={splitted || showSmallTimePicker}
                isLive={isLive}
                loading={loading || (isLive && !isPaused)}
                onRun={this.onRunQuery}
                showDropdown={!isLive}
              />

              {refreshInterval && <SetInterval func={this.onRunQuery} interval={refreshInterval} loading={loading} />}

              {hasLiveOption && (
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
              )}
            </ToolbarButtonRow>
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState, { exploreId }: OwnProps) => {
  const syncedTimes = state.explore.syncedTimes;
  const exploreItem: ExploreItemState = state.explore[exploreId]!;
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
    splitted: isSplit(state),
    refreshInterval,
    hasLiveOption,
    isLive,
    isPaused,
    syncedTimes,
    containerWidth,
  };
};

const mapDispatchToProps = {
  changeDatasource,
  changeRefreshInterval,
  clearAll: clearQueries,
  cancelQueries,
  runQueries,
  closeSplit: splitClose,
  split: splitOpen,
  syncTimes,
  onChangeTimeZone: updateTimeZoneForSession,
  clearCache,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const ExploreToolbar = hot(module)(connector(UnConnectedExploreToolbar));
